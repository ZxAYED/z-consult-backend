import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  LogAction,
  QueueStatus,
  StaffAvailability,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Use local business day boundaries. Default: Asia/Dhaka (UTC+6 => 360 minutes).
   * You can set TZ_OFFSET_MINUTES in env if needed.
   */
  private readonly tzOffsetMinutes = Number(
    process.env.TZ_OFFSET_MINUTES ?? 360,
  );

  private getDayRangeUtcFromInstant(date: Date) {
    const offsetMs = this.tzOffsetMinutes * 60_000;

    // Convert instant -> local view by adding offset, then use UTC getters
    const localMs = date.getTime() + offsetMs;
    const local = new Date(localMs);

    const y = local.getUTCFullYear();
    const m = local.getUTCMonth();
    const d = local.getUTCDate();

    const startLocalMs = Date.UTC(y, m, d, 0, 0, 0, 0);
    const endLocalMs = Date.UTC(y, m, d + 1, 0, 0, 0, 0);

    // Convert local midnight back to UTC instants
    return {
      startUtc: new Date(startLocalMs - offsetMs),
      endUtc: new Date(endLocalMs - offsetMs),
    };
  }

  private formatLocalTime(date: Date) {
    // Simple AM/PM formatting using TZ offset (no extra libs)
    const offsetMs = this.tzOffsetMinutes * 60_000;
    const local = new Date(date.getTime() + offsetMs);

    let h = local.getUTCHours();
    const m = local.getUTCMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;

    const mm = m.toString().padStart(2, '0');
    return `${h}:${mm} ${ampm}`;
  }

  async findAll() {
    const queueItems = await this.prisma.queueItem.findMany({
      where: { status: QueueStatus.ACTIVE },
      include: {
        appointment: {
          include: { service: true },
        },
      },
      orderBy: [{ appointment: { startAt: 'asc' } }, { queuedAt: 'asc' }],
    });

    return queueItems.map((item, index) => ({
      position: index + 1,
      ...item,
    }));
  }

  /**
   * Assigns the earliest ELIGIBLE queue appointment (not necessarily the very first one)
   * to the best staff (lowest load) and updates queue + appointment atomically.
   */
  async assignNext() {
    // Pull a small batch in order; increase if you expect big queues.
    const queueBatch = await this.prisma.queueItem.findMany({
      where: { status: QueueStatus.ACTIVE },
      include: {
        appointment: {
          include: { service: true },
        },
      },
      orderBy: [{ appointment: { startAt: 'asc' } }, { queuedAt: 'asc' }],
      take: 50,
    });

    if (queueBatch.length === 0) {
      throw new NotFoundException('Queue is empty');
    }

    // Try each queue item in order, assign the first that has an eligible staff.
    for (const item of queueBatch) {
      const appointment = item.appointment;

      // Only WAITING (unassigned) appointments should be in ACTIVE queue
      if (
        appointment.status !== AppointmentStatus.WAITING ||
        appointment.staffId !== null
      ) {
        // Data inconsistency: skip it (or you can fix it here)
        continue;
      }

      const startAt = appointment.startAt;
      const endAt = appointment.endAt;
      const requiredType = appointment.service.requiredStaffType;

      // Candidate staff (availability-filtered)
      const candidates = await this.prisma.staff.findMany({
        where: {
          type: requiredType,
          availability: StaffAvailability.AVAILABLE,
        },
        select: { id: true, name: true, dailyCapacity: true },
      });

      if (candidates.length === 0) {
        continue; // try next queue item
      }

      const staffIds = candidates.map((staff) => staff.id);
      const { startUtc, endUtc } = this.getDayRangeUtcFromInstant(startAt);

      // 1) Daily counts grouped (no N+1)
      const counts = await this.prisma.appointment.groupBy({
        by: ['staffId'],
        where: {
          staffId: { in: staffIds },
          status: { not: AppointmentStatus.CANCELLED },
          startAt: { gte: startUtc, lt: endUtc },
        },
        _count: { _all: true },
      });

      const countMap = new Map<string, number>();
      for (const row of counts) {
        if (row.staffId) countMap.set(row.staffId, row._count._all);
      }

      // 2) Conflicts in one query (no N+1)
      const conflicts = await this.prisma.appointment.findMany({
        where: {
          staffId: { in: staffIds },
          status: { not: AppointmentStatus.CANCELLED },
          AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
        },
        select: { staffId: true },
      });

      const conflictSet = new Set<string>();
      for (const conflict of conflicts)
        if (conflict.staffId) conflictSet.add(conflict.staffId);

      // 3) Choose best eligible staff: lowest load, then name
      const eligible = candidates
        .map((s) => ({
          staff: s,
          load: countMap.get(s.id) ?? 0,
          hasConflict: conflictSet.has(s.id),
        }))
        .filter((x) => x.load < x.staff.dailyCapacity && !x.hasConflict)
        .sort(
          (a, b) => a.load - b.load || a.staff.name.localeCompare(b.staff.name),
        );

      if (eligible.length === 0) {
        continue; // try next queue item
      }

      const selectedStaff = eligible[0].staff;

      // 4) Transaction-safe assignment (atomic)
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          // Atomic: mark queue item as ASSIGNED only if still ACTIVE
          const Queue = await tx.queueItem.updateMany({
            where: { id: item.id, status: QueueStatus.ACTIVE },
            data: { status: QueueStatus.ASSIGNED },
          });

          if (Queue.count === 0) {
            throw new ConflictException('Queue item is no longer active');
          }

          // Atomic: update appointment only if still WAITING and unassigned
          const ap = await tx.appointment.updateMany({
            where: {
              id: appointment.id,
              status: AppointmentStatus.WAITING,
              staffId: null,
            },
            data: {
              staffId: selectedStaff.id,
              status: AppointmentStatus.SCHEDULED,
            },
          });

          if (ap.count === 0) {
            throw new ConflictException('Appointment is no longer waiting');
          }

          const updatedAppointment = await tx.appointment.findUnique({
            where: { id: appointment.id },
            include: { service: true, staff: true },
          });

          const updatedQueueItem = await tx.queueItem.findUnique({
            where: { id: item.id },
          });

          // Activity log (required by spec)
          const timeStr = this.formatLocalTime(appointment.startAt);
          const message = `${timeStr} — Appointment for “${appointment.customerName}” auto-assigned to ${selectedStaff.name}.`;

          const log = await tx.activityLog.create({
            data: {
              action: LogAction.QUEUE_ASSIGNED,
              message,
              metadata: {
                appointmentId: appointment.id,
                staffId: selectedStaff.id,
              },
            },
          });

          return {
            appointment: updatedAppointment,
            queueItem: updatedQueueItem,
            assignedStaff: selectedStaff,
            log,
          };
        });

        return result; // ✅ assigned successfully
      } catch (e) {
        // If it was a race condition, try next item; otherwise rethrow
        if (e instanceof ConflictException) {
          continue;
        }
        throw e;
      }
    }

    // If we reached here, queue exists but nothing can be assigned right now
    throw new NotFoundException(
      'No eligible staff available for any active queued appointment.',
    );
  }
}

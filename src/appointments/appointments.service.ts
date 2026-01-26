import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  LogAction,
  Prisma,
  QueueStatus,
  StaffAvailability,
} from '@prisma/client';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { EligibleStaffDto } from './dto/eligible-staff.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Use Asia/Dhaka boundaries by default (UTC+6 => 360 minutes).
   * Override with env if you want: TZ_OFFSET_MINUTES=360
   */
  private readonly tzOffsetMinutes = Number(
    process.env.TZ_OFFSET_MINUTES ?? 360,
  );

  private getDayRangeUtcFromInstant(date: Date) {
    const offsetMs = this.tzOffsetMinutes * 60_000;

    // Convert instant -> "local" by adding offset, then compute local date parts using UTC getters
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

  private getDayRangeUtcFromLocalDateString(dateStr: string) {
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (!m)
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');

    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);

    const offsetMs = this.tzOffsetMinutes * 60_000;
    const startLocalMs = Date.UTC(year, month, day, 0, 0, 0, 0);
    const endLocalMs = Date.UTC(year, month, day + 1, 0, 0, 0, 0);

    return {
      startUtc: new Date(startLocalMs - offsetMs),
      endUtc: new Date(endLocalMs - offsetMs),
    };
  }

  private formatLocalTime(date: Date) {
    const offsetMs = this.tzOffsetMinutes * 60_000;
    const local = new Date(date.getTime() + offsetMs);

    let hours = local.getUTCHours();
    const minutes = local.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;

    const mm = minutes.toString().padStart(2, '0');
    return `${hours}:${mm} ${ampm}`;
  }

  private async hasOverlapConflict(
    staffId: string,
    startAt: Date,
    endAt: Date,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const existing = await this.prisma.appointment.findFirst({
      where: {
        staffId,
        status: { not: AppointmentStatus.CANCELLED },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
      },
      select: { id: true },
    });

    return !!existing;
  }

  private async getDailyCount(
    staffId: string,
    dayInstant: Date,
    excludeAppointmentId?: string,
  ): Promise<number> {
    const { startUtc, endUtc } = this.getDayRangeUtcFromInstant(dayInstant);

    return this.prisma.appointment.count({
      where: {
        staffId,
        status: { not: AppointmentStatus.CANCELLED },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        startAt: { gte: startUtc, lt: endUtc },
      },
    });
  }

  async getEligibleStaff(dto: EligibleStaffDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');

    const startAt = new Date(dto.startAt);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid startAt');
    }
    const endAt = new Date(
      startAt.getTime() + service.durationMinutes * 60_000,
    );

    const candidateStaff = await this.prisma.staff.findMany({
      where: { type: service.requiredStaffType },
      orderBy: { name: 'asc' },
    });

    if (candidateStaff.length === 0) {
      return {
        service,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        staff: [],
      };
    }

    const staffIds = candidateStaff.map((staffMember) => staffMember.id);
    const { startUtc, endUtc } = this.getDayRangeUtcFromInstant(startAt);

    // Counts grouped (no N+1)
    const todayCounts = await this.prisma.appointment.groupBy({
      by: ['staffId'],
      where: {
        staffId: { in: staffIds },
        status: { not: AppointmentStatus.CANCELLED },
        startAt: { gte: startUtc, lt: endUtc },
      },
      _count: { _all: true },
    });

    const countMap = new Map<string, number>();
    for (const row of todayCounts) {
      if (row.staffId) countMap.set(row.staffId, row._count._all);
    }

    // Conflicts in one query (no N+1)
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

    const staffResult = candidateStaff
      .map((staff) => {
        const todayCount = countMap.get(staff.id) ?? 0;
        const hasConflict = conflictSet.has(staff.id);

        const blockedReasons: string[] = [];
        if (staff.availability !== StaffAvailability.AVAILABLE) {
          blockedReasons.push('ON_LEAVE');
        }
        if (todayCount >= staff.dailyCapacity) {
          blockedReasons.push('CAPACITY_FULL');
        }
        if (hasConflict) {
          blockedReasons.push('TIME_CONFLICT');
        }

        const isEligible = blockedReasons.length === 0;

        return {
          id: staff.id,
          name: staff.name,
          type: staff.type,
          availability: staff.availability,
          todayCount,
          dailyCapacity: staff.dailyCapacity,
          loadLabel: `${todayCount}/${staff.dailyCapacity}`,
          hasConflict,
          isEligible,
          blockedReasons,
        };
      })
      .sort((a, b) => {
        if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
        if (a.todayCount !== b.todayCount) return a.todayCount - b.todayCount;
        return a.name.localeCompare(b.name);
      });

    return {
      service,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      staff: staffResult,
    };
  }

  async create(dto: CreateAppointmentDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');

    const startAt = new Date(dto.startAt);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid startAt');
    }
    const endAt = new Date(
      startAt.getTime() + service.durationMinutes * 60_000,
    );

    // Candidate staff (availability-filtered)
    const candidates = await this.prisma.staff.findMany({
      where: {
        type: service.requiredStaffType,
        availability: StaffAvailability.AVAILABLE,
      },
      select: { id: true, name: true, dailyCapacity: true },
    });

    let assignedStaffId: string | null = null;
    let appointmentStatus: AppointmentStatus = AppointmentStatus.WAITING;

    if (candidates.length > 0) {
      const staffIds = candidates.map((staff) => staff.id);
      const { startUtc, endUtc } = this.getDayRangeUtcFromInstant(startAt);

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

      const conflicts = await this.prisma.appointment.findMany({
        where: {
          staffId: { in: staffIds },
          status: { not: AppointmentStatus.CANCELLED },
          AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
        },
        select: { staffId: true },
      });

      const conflictSet = new Set<string>();
      for (const c of conflicts) if (c.staffId) conflictSet.add(c.staffId);

      const eligible = candidates
        .map((staff) => ({
          staff: staff,
          load: countMap.get(staff.id) ?? 0,
          hasConflict: conflictSet.has(staff.id),
        }))
        .filter((x) => x.load < x.staff.dailyCapacity && !x.hasConflict)
        .sort(
          (candidateA, candidateB) =>
            candidateA.load - candidateB.load ||
            candidateA.staff.name.localeCompare(candidateB.staff.name),
        );

      if (eligible.length > 0) {
        assignedStaffId = eligible[0].staff.id;
        appointmentStatus = AppointmentStatus.SCHEDULED;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          serviceId: dto.serviceId,
          staffId: assignedStaffId,
          startAt,
          endAt,
          status: appointmentStatus,
        },
        include: { service: true, staff: true },
      });

      if (appointmentStatus === AppointmentStatus.WAITING) {
        await tx.queueItem.create({
          data: { appointmentId: appointment.id, status: QueueStatus.ACTIVE },
        });

        const timeStr = this.formatLocalTime(appointment.startAt);
        await tx.activityLog.create({
          data: {
            action: LogAction.QUEUE_JOINED,
            message: `${timeStr} — Appointment for “${appointment.customerName}” added to queue.`,
            metadata: { appointmentId: appointment.id },
          },
        });
      } else if (appointmentStatus === AppointmentStatus.SCHEDULED) {
        const timeStr = this.formatLocalTime(appointment.startAt);
        const staffName = appointment.staff?.name ?? 'staff';
        await tx.activityLog.create({
          data: {
            action: LogAction.QUEUE_ASSIGNED,
            message: `${timeStr} — Appointment for “${appointment.customerName}” auto-assigned to ${staffName}.`,
            metadata: {
              appointmentId: appointment.id,
              staffId: appointment.staffId,
            },
          },
        });
      }

      return appointment;
    });
  }

  async findAll(
    page?: number,
    limit?: number,
    date?: string,
    search?: string,
    staffId?: string,
    status?: AppointmentStatus,
  ) {
    const where: Prisma.AppointmentWhereInput = {};

    if (date) {
      const { startUtc, endUtc } = this.getDayRangeUtcFromLocalDateString(date);
      where.startAt = { gte: startUtc, lt: endUtc };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        {
          id: { contains: term, mode: Prisma.QueryMode.insensitive },
        },
        {
          customerName: { contains: term, mode: Prisma.QueryMode.insensitive },
        },
        {
          customerEmail: { contains: term, mode: Prisma.QueryMode.insensitive },
        },
        {
          customerPhone: { contains: term, mode: Prisma.QueryMode.insensitive },
        },
      ];
    }

    if (staffId) where.staffId = staffId;
    if (status) where.status = status;

    const totalItems = await this.prisma.appointment.count({ where });
    const { skip, take, meta } = getPagination(page, limit, totalItems);

    const data = await this.prisma.appointment.findMany({
      where,
      skip,
      take,
      include: { service: true, staff: true },
      orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
    });

    return { data, meta };
  }

  async findOne(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, staff: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, staff: true, queueItem: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    // Compute next startAt/service/duration/endAt
    let nextStartAt = appointment.startAt;
    let nextServiceId = appointment.serviceId;
    let nextDuration = appointment.service.durationMinutes;

    if (dto.serviceId) {
      const svc = await this.prisma.service.findUnique({
        where: { id: dto.serviceId },
      });
      if (!svc) throw new NotFoundException('Service not found');
      nextServiceId = svc.id;
      nextDuration = svc.durationMinutes;
    }

    if (dto.startAt) {
      nextStartAt = new Date(dto.startAt);
      if (Number.isNaN(nextStartAt.getTime())) {
        throw new BadRequestException('Invalid startAt');
      }
    }

    const nextEndAt =
      dto.startAt || dto.serviceId
        ? new Date(nextStartAt.getTime() + nextDuration * 60_000)
        : appointment.endAt;

    // Determine next staffId and status
    const nextStaffId =
      dto.staffId !== undefined ? dto.staffId : appointment.staffId;

    let nextStatus = dto.status ?? appointment.status;

    // Invariants
    if (nextStatus === AppointmentStatus.WAITING) {
      // WAITING must be unassigned
      if (nextStaffId !== null) {
        // force consistent state
        // (or throw if you prefer strict)
        // throw new BadRequestException('WAITING appointments cannot have staff assigned');
      }
    }

    if (
      [
        AppointmentStatus.SCHEDULED,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.NO_SHOW,
      ].some((status) => status === nextStatus) &&
      nextStaffId === null
    ) {
      throw new BadRequestException(
        `${nextStatus} appointments must have an assigned staff member.`,
      );
    }

    // If staff/time/service changed and the appointment is not cancelled/waiting, validate assignment
    const assignmentChanged =
      dto.staffId !== undefined || !!dto.startAt || !!dto.serviceId;

    if (
      assignmentChanged &&
      nextStaffId &&
      nextStatus !== AppointmentStatus.CANCELLED &&
      nextStatus !== AppointmentStatus.WAITING
    ) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: nextStaffId },
      });
      if (!staff) throw new NotFoundException('Staff not found');

      if (staff.availability !== StaffAvailability.AVAILABLE) {
        throw new ConflictException(`${staff.name} is currently on leave.`);
      }

      // Capacity check (exclude this appointment)
      const dailyCount = await this.getDailyCount(nextStaffId, nextStartAt, id);
      if (dailyCount >= staff.dailyCapacity) {
        throw new ConflictException(
          `${staff.name} already has ${staff.dailyCapacity} appointments today.`,
        );
      }

      // Conflict overlap check (exclude this appointment)
      const hasConflict = await this.hasOverlapConflict(
        nextStaffId,
        nextStartAt,
        nextEndAt,
        id,
      );
      if (hasConflict) {
        throw new ConflictException(
          `This staff member already has an appointment at this time.`,
        );
      }
    }

    // If staffId explicitly set to null and status not provided, default to WAITING
    if (dto.staffId === null && dto.status === undefined) {
      nextStatus = AppointmentStatus.WAITING;
    }

    // Ensure WAITING implies staffId null (strong consistency)
    const finalStaffId =
      nextStatus === AppointmentStatus.WAITING ? null : nextStaffId;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          serviceId: nextServiceId,
          staffId: finalStaffId,
          startAt: nextStartAt,
          endAt: nextEndAt,
          status: nextStatus,
        },
        include: { service: true, staff: true },
      });

      // Queue state sync
      const existingQueue = await tx.queueItem.findUnique({
        where: { appointmentId: id },
      });

      if (nextStatus === AppointmentStatus.WAITING) {
        if (existingQueue) {
          if (existingQueue.status !== QueueStatus.ACTIVE) {
            await tx.queueItem.update({
              where: { appointmentId: id },
              data: { status: QueueStatus.ACTIVE },
            });
          }
        } else {
          await tx.queueItem.create({
            data: { appointmentId: id, status: QueueStatus.ACTIVE },
          });
        }
      } else if (
        [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.COMPLETED,
          AppointmentStatus.NO_SHOW,
        ].some((status) => status === nextStatus)
      ) {
        if (existingQueue && existingQueue.status === QueueStatus.ACTIVE) {
          await tx.queueItem.update({
            where: { appointmentId: id },
            data: { status: QueueStatus.ASSIGNED },
          });
        }
      } else if (nextStatus === AppointmentStatus.CANCELLED) {
        if (existingQueue && existingQueue.status === QueueStatus.ACTIVE) {
          await tx.queueItem.update({
            where: { appointmentId: id },
            data: { status: QueueStatus.CANCELLED },
          });
        }
      }

      return updated;
    });
  }

  async cancel(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: { status: AppointmentStatus.CANCELLED },
        include: { service: true, staff: true },
      });

      const queueItem = await tx.queueItem.findUnique({
        where: { appointmentId: id },
      });

      if (queueItem && queueItem.status === QueueStatus.ACTIVE) {
        await tx.queueItem.update({
          where: { appointmentId: id },
          data: { status: QueueStatus.CANCELLED },
        });
      }

      return updated;
    });
  }
}

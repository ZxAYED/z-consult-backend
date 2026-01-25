import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, QueueStatus, StaffAvailability } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    // Get all ACTIVE queue items
    const queueItems = await this.prisma.queueItem.findMany({
      where: { status: QueueStatus.ACTIVE },
      include: {
        appointment: {
          include: {
            service: true,
          },
        },
      },
      orderBy: [
        { appointment: { startAt: 'asc' } },
        { queuedAt: 'asc' },
      ],
    });

    // Add position (1-based index)
    return queueItems.map((item, index) => ({
      position: index + 1,
      ...item,
    }));
  }

  async assignNext() {
    // 1. Find earliest ACTIVE queue item
    const nextItem = await this.prisma.queueItem.findFirst({
      where: { status: QueueStatus.ACTIVE },
      include: {
        appointment: {
          include: {
            service: true,
          },
        },
      },
      orderBy: [
        { appointment: { startAt: 'asc' } },
        { queuedAt: 'asc' },
      ],
    });

    if (!nextItem) {
      throw new NotFoundException('Queue is empty');
    }

    const appointment = nextItem.appointment;
    const startAt = appointment.startAt;
    const endAt = appointment.endAt;

    // 2. Find eligible staff
    const eligibleStaff = await this.prisma.staff.findMany({
      where: {
        type: appointment.service.requiredStaffType,
        availability: StaffAvailability.AVAILABLE,
      },
    });

    const staffCandidates: { staff: any; load: number }[] = [];

    // Helper to check capacity and conflict (duplicated logic from AppointmentService, 
    // ideally should be shared but keeping here for transactional safety within this context)
    
    for (const staff of eligibleStaff) {
      // Check Daily Capacity
      const startOfDay = new Date(startAt);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(startAt);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const dailyCount = await this.prisma.appointment.count({
        where: {
          staffId: staff.id,
          status: { not: AppointmentStatus.CANCELLED },
          startAt: { gte: startOfDay, lte: endOfDay },
        },
      });

      if (dailyCount >= staff.dailyCapacity) continue;

      // Check Conflict
      const conflict = await this.prisma.appointment.findFirst({
        where: {
          staffId: staff.id,
          status: { not: AppointmentStatus.CANCELLED },
          AND: [
            { startAt: { lt: endAt } },
            { endAt: { gt: startAt } },
          ],
        },
      });

      if (conflict) continue;

      staffCandidates.push({ staff, load: dailyCount });
    }

    if (staffCandidates.length === 0) {
      throw new NotFoundException(
        'No eligible staff available for the earliest queued appointment.',
      );
    }

    // Sort by load ascending
    staffCandidates.sort((a, b) => a.load - b.load);
    const selectedStaff = staffCandidates[0].staff;

    // 3. Assign in transaction
    return this.prisma.$transaction(async (tx) => {
      // Verify queue item is still ACTIVE (concurrency check)
      const currentQueueItem = await tx.queueItem.findUnique({
        where: { id: nextItem.id },
      });

      if (!currentQueueItem || currentQueueItem.status !== QueueStatus.ACTIVE) {
        throw new NotFoundException('Queue item is no longer active');
      }

      // Update Appointment
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          staffId: selectedStaff.id,
          status: AppointmentStatus.SCHEDULED,
        },
        include: {
          service: true,
          staff: true,
        },
      });

      // Update QueueItem
      const updatedQueueItem = await tx.queueItem.update({
        where: { id: nextItem.id },
        data: {
          status: QueueStatus.ASSIGNED,
        },
      });

      return {
        appointment: updatedAppointment,
        queueItem: updatedQueueItem,
        assignedStaff: selectedStaff,
      };
    });
  }
}

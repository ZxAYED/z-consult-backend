import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  Prisma,
  QueueStatus,
  StaffAvailability,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(date?: string) {
    let targetDate = new Date();

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BadRequestException('Date must be in YYYY-MM-DD format');
      }
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        throw new BadRequestException('Invalid date');
      }
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Common filter for "Today's Appointments"
    const todayFilter: Prisma.AppointmentWhereInput = {
      startAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    // 1. Total Appointments Today (excluding CANCELLED per common sense, but requirement says "Total" - usually implies active ones.
    // Spec says: "count appointments where startAt in day range AND status != CANCELLED"
    const totalAppointmentsToday = await this.prisma.appointment.count({
      where: {
        ...todayFilter,
        status: { not: AppointmentStatus.CANCELLED },
      },
    });

    // 2. Completed Count
    const completedCount = await this.prisma.appointment.count({
      where: {
        ...todayFilter,
        status: AppointmentStatus.COMPLETED,
      },
    });

    // 3. Pending Count (SCHEDULED + WAITING in day range)
    const pendingCount = await this.prisma.appointment.count({
      where: {
        ...todayFilter,
        status: {
          in: [AppointmentStatus.SCHEDULED, AppointmentStatus.WAITING],
        },
      },
    });

    // 4. Waiting Queue Count (Active Queue Items)
    // Requirement implies "Current waiting queue", which usually means ALL active queue items regardless of date.
    // However, if we want strict "today's waiting", we filter by day.
    // Usually "Queue" is a realtime structure.
    // Let's use QueueItem table as requested.
    const waitingQueueCount = await this.prisma.queueItem.count({
      where: {
        status: QueueStatus.ACTIVE,
      },
    });

    // 5. Staff Load Summary
    // We need to count appointments per staff for the day.
    // Efficient way: Fetch all staff, then fetch grouped counts.

    const [allStaff, appointmentCounts] = await Promise.all([
      this.prisma.staff.findMany({
        orderBy: { name: 'asc' },
      }),
      this.prisma.appointment.groupBy({
        by: ['staffId'],
        where: {
          ...todayFilter,
          status: { not: AppointmentStatus.CANCELLED },
          staffId: { not: null },
        },
        _count: {
          staffId: true,
        },
      }),
    ]);

    // Map counts to a dictionary for O(1) lookup
    const countsMap = new Map<string, number>();
    appointmentCounts.forEach((item) => {
      if (item.staffId) {
        countsMap.set(item.staffId, item._count.staffId);
      }
    });

    const staffLoadSummary = allStaff.map((staff) => {
      const todayCount = countsMap.get(staff.id) || 0;
      let label = 'OK';

      if (staff.availability === StaffAvailability.ON_LEAVE) {
        label = 'On Leave';
      } else if (todayCount >= staff.dailyCapacity) {
        label = 'Booked';
      }

      return {
        staffId: staff.id,
        name: staff.name,
        type: staff.type,
        availability: staff.availability,
        todayCount,
        dailyCapacity: staff.dailyCapacity,
        label,
      };
    });

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalAppointmentsToday,
      completedCount,
      pendingCount,
      waitingQueueCount,
      staffLoadSummary,
    };
  }
}

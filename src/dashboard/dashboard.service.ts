import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  LogAction,
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

    const [
      totalAppointmentsToday,
      completedAppointmentsToday,
      pendingAppointmentsToday,
      waitingQueueCount,
      latestActivityLogs,
      totalServices,
      totalAppointmentsAllTime,
      completedAppointmentsAllTime,
      allStaff,
      appointmentCounts,
    ] = await Promise.all([
      this.prisma.appointment.count({
        where: {
          ...todayFilter,
          status: { not: AppointmentStatus.CANCELLED },
        },
      }),
      this.prisma.appointment.count({
        where: {
          ...todayFilter,
          status: AppointmentStatus.COMPLETED,
        },
      }),
      this.prisma.appointment.count({
        where: {
          ...todayFilter,
          status: {
            in: [AppointmentStatus.SCHEDULED, AppointmentStatus.WAITING],
          },
        },
      }),
      this.prisma.queueItem.count({
        where: {
          status: QueueStatus.ACTIVE,
        },
      }),
      this.prisma.activityLog.findMany({
        where: {
          action: {
            in: [
              LogAction.QUEUE_ASSIGNED,
              LogAction.QUEUE_JOINED,
              LogAction.APPOINTMENT_CREATED,
              LogAction.APPOINTMENT_UPDATED,
              LogAction.APPOINTMENT_CANCELLED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.service.count(),
      this.prisma.appointment.count({
        where: { status: { not: AppointmentStatus.CANCELLED } },
      }),
      this.prisma.appointment.count({
        where: { status: AppointmentStatus.COMPLETED },
      }),
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

    const totalStaff = allStaff.length;
    const availableStaffCount = allStaff.filter(
      (staff) => staff.availability === StaffAvailability.AVAILABLE,
    ).length;
    const onLeaveStaffCount = allStaff.filter(
      (staff) => staff.availability === StaffAvailability.ON_LEAVE,
    ).length;

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
      completedCount: completedAppointmentsToday,
      pendingCount: pendingAppointmentsToday,
      waitingQueueCount,
      totalStaff,
      availableStaffCount,
      onLeaveStaffCount,
      totalServices,
      totalAppointmentsAllTime,
      completedAppointmentsAllTime,
      latestActivityLogs,
      staffLoadSummary,
    };
  }
}

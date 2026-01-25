import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
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

  private async checkConflict(
    staffId: string,
    startAt: Date,
    endAt: Date,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const existing = await this.prisma.appointment.findFirst({
      where: {
        staffId,
        status: { not: AppointmentStatus.CANCELLED },
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
        AND: [
          { startAt: { lt: endAt } }, // Existing starts before new ends
          { endAt: { gt: startAt } }, // Existing ends after new starts
        ],
      },
    });

    return !!existing;
  }

  private async checkDailyCapacity(
    staffId: string,
    date: Date,
    capacity: number,
  ): Promise<boolean> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const count = await this.prisma.appointment.count({
      where: {
        staffId,
        status: { not: AppointmentStatus.CANCELLED },
        startAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    return count >= capacity;
  }

  async getEligibleStaff(dto: EligibleStaffDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60000);

    // 1. Fetch candidate staff
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

    const staffIds = candidateStaff.map((s) => s.id);

    // 2. Fetch today's appointment counts for all candidates
    const startOfDay = new Date(startAt);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startAt);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const todayCounts = await this.prisma.appointment.groupBy({
      by: ['staffId'],
      where: {
        staffId: { in: staffIds },
        status: { not: AppointmentStatus.CANCELLED },
        startAt: { gte: startOfDay, lte: endOfDay },
      },
      _count: { staffId: true },
    });

    const countMap = new Map<string, number>();
    todayCounts.forEach((c) => {
      if (c.staffId) countMap.set(c.staffId, c._count.staffId);
    });

    // 3. Fetch conflicting appointments for all candidates
    const conflicts = await this.prisma.appointment.findMany({
      where: {
        staffId: { in: staffIds },
        status: { not: AppointmentStatus.CANCELLED },
        AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
      },
      select: { staffId: true },
    });

    const conflictSet = new Set<string>();
    conflicts.forEach((c) => {
      if (c.staffId) conflictSet.add(c.staffId);
    });

    // 4. Compute eligibility and build response
    const staffResult = candidateStaff.map((staff) => {
      const todayCount = countMap.get(staff.id) || 0;
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
    });

    // 5. Sort: Eligible first, then by load, then by name
    staffResult.sort((a, b) => {
      if (a.isEligible !== b.isEligible) {
        return a.isEligible ? -1 : 1; // Eligible first
      }
      if (a.todayCount !== b.todayCount) {
        return a.todayCount - b.todayCount; // Lower load first
      }
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

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60000);

    const eligibleStaff = await this.prisma.staff.findMany({
      where: {
        type: service.requiredStaffType,
        availability: StaffAvailability.AVAILABLE,
      },
    });

    let assignedStaffId: string | null = null;
    let appointmentStatus: AppointmentStatus = AppointmentStatus.WAITING;

    const staffCandidates: { staff: any; load: number }[] = [];

    for (const staff of eligibleStaff) {
      const isFull = await this.checkDailyCapacity(
        staff.id,
        startAt,
        staff.dailyCapacity,
      );
      if (isFull) continue;

      const hasConflict = await this.checkConflict(staff.id, startAt, endAt);
      if (hasConflict) continue;

      const startOfDay = new Date(startAt);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(startAt);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const load = await this.prisma.appointment.count({
        where: {
          staffId: staff.id,
          status: { not: AppointmentStatus.CANCELLED },
          startAt: { gte: startOfDay, lte: endOfDay },
        },
      });

      staffCandidates.push({ staff, load });
    }

    staffCandidates.sort((a, b) => a.load - b.load);

    if (staffCandidates.length > 0) {
      assignedStaffId = staffCandidates[0].staff.id;
      appointmentStatus = AppointmentStatus.SCHEDULED;
    }

    // Use transaction to create appointment and queue item if needed
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
        include: {
          service: true,
          staff: true,
        },
      });

      if (appointmentStatus === AppointmentStatus.WAITING) {
        await tx.queueItem.create({
          data: {
            appointmentId: appointment.id,
            status: QueueStatus.ACTIVE,
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
    staffId?: string,
    status?: AppointmentStatus,
  ) {
    const where: Prisma.AppointmentWhereInput = {};

    if (date) {
      const searchDate = new Date(date);
      const startOfDay = new Date(searchDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(searchDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      where.startAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (staffId) {
      where.staffId = staffId;
    }

    if (status) {
      where.status = status;
    }

    const totalItems = await this.prisma.appointment.count({ where });
    const { skip, take, meta } = getPagination(page, limit, totalItems);

    const data = await this.prisma.appointment.findMany({
      where,
      skip,
      take,
      include: {
        service: true,
        staff: true,
      },
      orderBy: { startAt: 'asc' },
    });

    return { data, meta };
  }

  async findOne(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        service: true,
        staff: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, staff: true, queueItem: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    let startAt = appointment.startAt;
    let endAt = appointment.endAt;
    let serviceId = appointment.serviceId;
    let duration = appointment.service.durationMinutes;

    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: dto.serviceId },
      });
      if (!service) throw new NotFoundException('Service not found');
      serviceId = service.id;
      duration = service.durationMinutes;
    }

    if (dto.startAt) {
      startAt = new Date(dto.startAt);
    }

    if (dto.startAt || dto.serviceId) {
      endAt = new Date(startAt.getTime() + duration * 60000);
    }

    const staffId =
      dto.staffId !== undefined ? dto.staffId : appointment.staffId;
    let status = dto.status || appointment.status;

    if (
      staffId &&
      (staffId !== appointment.staffId || dto.startAt || dto.serviceId)
    ) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: staffId },
      });
      if (!staff) throw new NotFoundException('Staff not found');

      if (staffId !== appointment.staffId) {
        const isFull = await this.checkDailyCapacity(
          staffId,
          startAt,
          staff.dailyCapacity,
        );
        if (isFull) {
          throw new ConflictException(
            `${staff.name} has reached daily capacity.`,
          );
        }
      }

      const hasConflict = await this.checkConflict(staffId, startAt, endAt, id);

      if (hasConflict) {
        throw new ConflictException(
          `Staff member already has an appointment at this time.`,
        );
      }
    }

    if (staffId === null && !dto.status) {
      status = AppointmentStatus.WAITING;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          serviceId,
          staffId,
          startAt,
          endAt,
          status,
        },
        include: {
          service: true,
          staff: true,
        },
      });

      // Handle QueueItem updates
      if (status === AppointmentStatus.WAITING) {
        // Ensure QueueItem exists and is ACTIVE
        const existingQueue = await tx.queueItem.findUnique({
          where: { appointmentId: id },
        });

        if (existingQueue) {
          if (existingQueue.status !== QueueStatus.ACTIVE) {
            await tx.queueItem.update({
              where: { appointmentId: id },
              data: { status: QueueStatus.ACTIVE },
            });
          }
        } else {
          await tx.queueItem.create({
            data: {
              appointmentId: id,
              status: QueueStatus.ACTIVE,
            },
          });
        }
      } else if (
        status === AppointmentStatus.SCHEDULED ||
        status === AppointmentStatus.COMPLETED
      ) {
        // If assigned/completed, mark queue as ASSIGNED
        const existingQueue = await tx.queueItem.findUnique({
          where: { appointmentId: id },
        });
        if (existingQueue && existingQueue.status === QueueStatus.ACTIVE) {
          await tx.queueItem.update({
            where: { appointmentId: id },
            data: { status: QueueStatus.ASSIGNED },
          });
        }
      } else if (status === AppointmentStatus.CANCELLED) {
        const existingQueue = await tx.queueItem.findUnique({
          where: { appointmentId: id },
        });
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

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: { status: AppointmentStatus.CANCELLED },
        include: { service: true, staff: true },
      });

      // Update queue item if exists
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

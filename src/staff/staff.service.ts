import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateMyAvailabilityDto } from './dto/update-my-availability.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStaffDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Transaction to create User + Staff
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
          role: Role.STAFF,
        },
      });

      const staff = await tx.staff.create({
        data: {
          userId: user.id,
          name: dto.name,
          type: dto.type,
          dailyCapacity: dto.dailyCapacity ?? 5,
          availability: dto.availability,
        },
      });

      return staff;
    });
  }

  async findAll(page?: number, limit?: number) {
    const totalItems = await this.prisma.staff.count();
    const { skip, take, meta } = getPagination(page, limit, totalItems);

    const data = await this.prisma.staff.findMany({
      skip,
      take,
      include: {
        user: {
          select: { email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data, meta };
  }

  async findOne(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return staff;
  }

  async update(id: string, dto: UpdateStaffDto) {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff not found');

    const updated = await this.prisma.staff.update({
      where: { id },
      data: {
        ...dto,
      },
    });

    // Sync name to User model if changed
    if (dto.name) {
      await this.prisma.user.update({
        where: { id: staff.userId },
        data: { name: dto.name },
      });
    }

    return updated;
  }

  async remove(id: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff not found');

    // Cascade delete handles staff deletion when user is deleted
    await this.prisma.user.delete({
      where: { id: staff.userId },
    });

    return { success: true };
  }

  async updateMyAvailability(userId: string, dto: UpdateMyAvailabilityDto) {
    const staff = await this.prisma.staff.findUnique({
      where: { userId },
    });

    if (!staff) {
      throw new NotFoundException('Staff profile not found for current user');
    }

    return this.prisma.staff.update({
      where: { id: staff.id },
      data: {
        availability: dto.availability,
      },
    });
  }
}

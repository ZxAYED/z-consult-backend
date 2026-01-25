import { Injectable, NotFoundException } from '@nestjs/common';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStaffDto) {
    return await this.prisma.staff.create({
      data: {
        name: dto.name,
        type: dto.type,
        dailyCapacity: dto.dailyCapacity ?? 5,
        availability: dto.availability,
      },
    });
  }

  async findAll(page?: number, limit?: number) {
    const totalItems = await this.prisma.staff.count();
    const { skip, take, meta } = getPagination(page, limit, totalItems);

    const data = await this.prisma.staff.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });

    return { data, meta };
  }

  async findOne(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return staff;
  }

  async update(id: string, dto: UpdateStaffDto) {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff not found');

    return await this.prisma.staff.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff not found');

    await this.prisma.staff.delete({ where: { id } });
    return { success: true };
  }
}

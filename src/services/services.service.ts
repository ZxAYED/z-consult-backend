import { Injectable, NotFoundException } from '@nestjs/common';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceDto) {
    return await this.prisma.service.create({
      data: dto,
    });
  }

  async findAll(page?: number, limit?: number) {
    const totalItems = await this.prisma.service.count();
    const { skip, take, meta } = getPagination(page, limit, totalItems);

    const data = await this.prisma.service.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });

    return { data, meta };
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  async update(id: string, dto: UpdateServiceDto) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');

    await this.prisma.service.delete({ where: { id } });
    return { success: true };
  }
}

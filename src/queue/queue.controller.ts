import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { sendResponse } from 'src/utils/sendResponse';
import { QueueService } from './queue.service';

@ApiTags('Queue')
@ApiBearerAuth()
@Controller('queue')
@Roles(Role.ADMIN)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get()
  async findAll() {
    const data = await this.queueService.findAll();
    return sendResponse('Queue fetched successfully', data);
  }

  @Post('assign')
  async assignNext() {
    const data = await this.queueService.assignNext();
    return sendResponse('Next queue item assigned successfully', data);
  }
}

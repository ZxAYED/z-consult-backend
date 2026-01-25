import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentStatus, Role } from '@prisma/client';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { sendResponse } from 'src/utils/sendResponse';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { EligibleStaffDto } from './dto/eligible-staff.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
@Roles(Role.ADMIN) // All endpoints are Admin-only
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('eligible-staff')
  async getEligibleStaff(@Query() dto: EligibleStaffDto) {
    const data = await this.appointmentsService.getEligibleStaff(dto);
    return sendResponse('Eligible staff fetched successfully', data);
  }

  @Post()
  async create(@Body() dto: CreateAppointmentDto) {
    const data = await this.appointmentsService.create(dto);
    return sendResponse('Appointment created successfully', data);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('date') date?: string,
    @Query('staffId') staffId?: string,
    @Query('status') status?: AppointmentStatus,
  ) {
    const result = await this.appointmentsService.findAll(
      page,
      limit,
      date,
      staffId,
      status,
    );
    return sendResponse('Appointments fetched successfully', result);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.appointmentsService.findOne(id);
    return sendResponse('Appointment details fetched successfully', data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    const data = await this.appointmentsService.update(id, dto);
    return sendResponse('Appointment updated successfully', data);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    const data = await this.appointmentsService.cancel(id);
    return sendResponse('Appointment cancelled successfully', data);
  }
}

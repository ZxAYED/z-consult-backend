import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { sendResponse } from 'src/utils/sendResponse';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Roles(Role.ADMIN)
  @Post()
  async create(@Body() dto: CreateStaffDto) {
    const data = await this.staffService.create(dto);
    return sendResponse('Staff created successfully', data);
  }

  @Roles(Role.ADMIN)
  @Get()
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    const result = await this.staffService.findAll(page, limit);
    return sendResponse('Staff list fetched successfully', result);
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.staffService.findOne(id);
    return sendResponse('Staff details fetched successfully', data);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    const data = await this.staffService.update(id, dto);
    return sendResponse('Staff updated successfully', data);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.staffService.remove(id);
    return sendResponse('Staff deleted successfully');
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { StaffAvailability } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMyAvailabilityDto {
  @ApiProperty({ enum: StaffAvailability, example: StaffAvailability.ON_LEAVE })
  @IsEnum(StaffAvailability)
  availability!: StaffAvailability;
}

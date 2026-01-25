import { ApiPropertyOptional } from '@nestjs/swagger';
import { StaffType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateServiceDto {
  @ApiPropertyOptional({ example: 'General Consultation' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 30, minimum: 5, maximum: 240 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  durationMinutes?: number;

  @ApiPropertyOptional({ enum: StaffType, example: StaffType.DOCTOR })
  @IsOptional()
  @IsEnum(StaffType)
  requiredStaffType?: StaffType;
}

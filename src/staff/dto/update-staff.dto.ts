import { ApiPropertyOptional } from '@nestjs/swagger';
import { StaffAvailability, StaffType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateStaffDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: StaffType, example: StaffType.DOCTOR })
  @IsOptional()
  @IsEnum(StaffType)
  type?: StaffType;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  dailyCapacity?: number;

  @ApiPropertyOptional({
    enum: StaffAvailability,
    example: StaffAvailability.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(StaffAvailability)
  availability?: StaffAvailability;
}

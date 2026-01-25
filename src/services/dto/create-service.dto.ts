import { ApiProperty } from '@nestjs/swagger';
import { StaffType } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ example: 'General Consultation' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 30, minimum: 5, maximum: 240 })
  @IsInt()
  @Min(5)
  @Max(240)
  durationMinutes!: number;

  @ApiProperty({ enum: StaffType, example: StaffType.DOCTOR })
  @IsEnum(StaffType)
  requiredStaffType!: StaffType;
}

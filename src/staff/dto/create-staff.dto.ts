import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffAvailability, StaffType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStaffDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'john@clinic.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: StaffType, example: StaffType.DOCTOR })
  @IsEnum(StaffType)
  type!: StaffType;

  @ApiPropertyOptional({ example: 5, default: 5, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  dailyCapacity?: number;

  @ApiPropertyOptional({
    enum: StaffAvailability,
    default: StaffAvailability.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(StaffAvailability)
  availability?: StaffAvailability;
}

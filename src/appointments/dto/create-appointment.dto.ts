import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'Alice Wonderland' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  customerName!: string;

  @ApiPropertyOptional({ example: 'alice@example.com' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({ example: 'service-uuid-123' })
  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({ example: '2025-02-15T10:00:00Z' })
  @IsISO8601()
  @IsNotEmpty()
  startAt!: string;
}

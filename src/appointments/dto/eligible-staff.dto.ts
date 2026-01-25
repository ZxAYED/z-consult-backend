import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsUUID } from 'class-validator';

export class EligibleStaffDto {
  @ApiProperty({ example: 'service-uuid-123' })
  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({ example: '2025-02-15T10:00:00Z' })
  @IsISO8601()
  @IsNotEmpty()
  startAt!: string;
}

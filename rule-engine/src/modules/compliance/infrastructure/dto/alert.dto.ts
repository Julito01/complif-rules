import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating an alert's status (e.g., resolve, dismiss).
 */
export class UpdateAlertDto {
  @ApiProperty({
    description: 'New alert status',
    example: 'ACKNOWLEDGED',
    enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'],
  })
  @IsString()
  @MaxLength(20)
  status: string;

  @ApiPropertyOptional({ description: 'Optional resolution message' })
  @IsOptional()
  @IsString()
  message?: string;
}

/**
 * Query DTO for filtering alerts.
 */
export class AlertQueryDto {
  @ApiPropertyOptional({ description: 'Filter by account UUID' })
  @IsOptional()
  @IsUUID()
  idAccount?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by severity',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ description: 'Filter by category', example: 'AML' })
  @IsOptional()
  @IsString()
  category?: string;
}

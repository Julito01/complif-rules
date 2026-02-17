import { IsString, IsUUID, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSignatureRequestDto {
  @ApiProperty({ description: 'Account UUID', example: '00000000-0000-4000-a000-000000000001' })
  @IsUUID()
  idAccount: string;

  @ApiProperty({ description: 'Faculty UUID', example: '00000000-0000-4000-a000-000000000002' })
  @IsUUID()
  idFaculty: string;

  @ApiProperty({
    description: 'Signature rule UUID',
    example: '00000000-0000-4000-a000-000000000030',
  })
  @IsUUID()
  idRule: string;

  @ApiPropertyOptional({ description: 'External reference identifier' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Reference type (e.g. PAYMENT, CONTRACT)' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Human-readable description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 expiration datetime',
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

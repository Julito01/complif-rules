import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  MaxLength,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── List DTOs ──────────────────────────────────────────────────────

export class CreateComplianceListDto {
  @ApiProperty({
    description: 'Unique list code within organization',
    example: 'SANCTIONED_COUNTRIES',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  code: string;

  @ApiProperty({
    description: 'Human-readable name',
    example: 'Sanctioned Countries',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Description of the list purpose' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'List type', enum: ['BLACKLIST', 'WHITELIST'], example: 'BLACKLIST' })
  @IsString()
  @IsIn(['BLACKLIST', 'WHITELIST'])
  type: 'BLACKLIST' | 'WHITELIST';

  @ApiProperty({
    description: 'Type of entity the list screens',
    enum: ['COUNTRY', 'ACCOUNT', 'COUNTERPARTY'],
    example: 'COUNTRY',
  })
  @IsString()
  @IsIn(['COUNTRY', 'ACCOUNT', 'COUNTERPARTY'])
  entityType: 'COUNTRY' | 'ACCOUNT' | 'COUNTERPARTY';

  @ApiPropertyOptional({ description: 'Whether the list is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateComplianceListDto {
  @ApiPropertyOptional({ description: 'Updated name', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the list is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Entry DTOs ─────────────────────────────────────────────────────

export class CreateComplianceListEntryDto {
  @ApiProperty({
    description: 'The value to add to the list (e.g. country code, account ID)',
    example: 'IR',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  value: string;

  @ApiPropertyOptional({ description: 'Human-readable label for the entry', example: 'Iran' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @ApiPropertyOptional({
    description: 'Arbitrary metadata',
    example: { reason: 'OFAC sanction', since: '2020-01-01' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class BulkCreateEntriesDto {
  @ApiProperty({
    description: 'Array of entries to add',
    type: [CreateComplianceListEntryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateComplianceListEntryDto)
  entries: CreateComplianceListEntryDto[];
}

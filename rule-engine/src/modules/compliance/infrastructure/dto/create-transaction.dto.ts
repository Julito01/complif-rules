import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsDateString,
  IsObject,
  IsBoolean,
  Min,
  MaxLength,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for ingesting a new transaction.
 *
 * Required: idAccount, type, amount, currency, datetime
 * All other fields are optional and backward-compatible.
 */
export class CreateTransactionDto {
  @ApiProperty({ description: 'Account UUID', example: '00000000-0000-4000-a000-000000000001' })
  @IsUUID()
  idAccount: string;

  @ApiProperty({ description: 'Transaction type', example: 'CASH_OUT', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  type: string;

  @ApiPropertyOptional({
    description: 'Transaction sub-type',
    example: 'WIRE_TRANSFER',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  subType?: string;

  @ApiProperty({ description: 'Transaction amount', example: 15000, minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'ISO 4217 currency code (3 chars)',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiPropertyOptional({
    description: 'Normalized amount in base currency',
    example: 15000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountNormalized?: number;

  @ApiPropertyOptional({
    description: 'Normalized currency code',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyNormalized?: string;

  @ApiProperty({ description: 'ISO 8601 transaction datetime', example: '2026-02-13T10:00:00Z' })
  @IsDateString()
  datetime: string;

  @ApiPropertyOptional({ description: 'Transaction date (YYYY-MM-DD)', example: '2026-02-13' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Country code or name', example: 'BR', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ description: 'Counterparty identifier', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  counterpartyId?: string;

  @ApiPropertyOptional({ description: 'Transaction channel', example: 'MOBILE', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  channel?: string;

  @ApiPropertyOptional({ description: 'Asset quantity (crypto/securities)' })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Asset identifier', example: 'BTC', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  asset?: string;

  @ApiPropertyOptional({ description: 'Asset price at transaction time' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ description: 'Whether the transaction is voided', default: false })
  @IsOptional()
  @IsBoolean()
  isVoided?: boolean;

  @ApiPropertyOptional({ description: 'Whether the transaction is blocked', default: false })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @ApiPropertyOptional({ description: 'Whether the transaction is deleted', default: false })
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;

  @ApiPropertyOptional({ description: 'External reference code', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalCode?: string;

  @ApiPropertyOptional({
    description: 'Arbitrary transaction data',
    example: { reference: 'INV-001' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Transaction origin', example: 'API', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  origin?: string;

  @ApiPropertyOptional({ description: 'Device information', example: { ip: '192.168.1.1' } })
  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Batch/lot UUID' })
  @IsOptional()
  @IsUUID()
  idTransactionLote?: string;

  @ApiPropertyOptional({ description: 'Additional metadata', example: { source: 'test' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

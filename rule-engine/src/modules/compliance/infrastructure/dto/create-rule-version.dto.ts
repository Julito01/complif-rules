import {
  IsInt,
  IsObject,
  IsArray,
  IsOptional,
  IsBoolean,
  IsDateString,
  Min,
  ValidateNested,
  IsString,
  IsNumber,
  IsIn,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested validation classes ──────────────────────────────────

/**
 * Validates a single action definition.
 */
export class ActionDto {
  @ApiProperty({ description: 'Action type', example: 'create_alert' })
  @IsString()
  type: string;

  @ApiPropertyOptional({
    description: 'Alert severity',
    example: 'HIGH',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ description: 'Alert category', example: 'AML' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Alert message',
    example: 'High amount transaction detected',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Webhook or callback URL' })
  @IsOptional()
  @IsString()
  url?: string;
}

/**
 * Validates the sliding-window specification.
 */
export class WindowDto {
  @ApiProperty({ description: 'Window duration', example: 24, minimum: 1 })
  @IsNumber()
  @Min(1)
  duration: number;

  @ApiProperty({
    description: 'Window time unit',
    enum: ['minutes', 'hours', 'days'],
    example: 'hours',
  })
  @IsIn(['minutes', 'hours', 'days'])
  unit: string;
}

/**
 * DTO for creating a new rule version.
 *
 * Rule versions are immutable — once created, they cannot be modified.
 * To change a rule, create a new version and deactivate the old one.
 */
export class CreateRuleVersionDto {
  @ApiProperty({
    description: 'Condition tree (all/any combinators with fact/operator/value leaves)',
    example: { all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 10000 }] },
  })
  @IsObject()
  conditions: Record<string, unknown>;

  @ApiProperty({
    description: 'Actions to execute when rule triggers',
    type: () => [ActionDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions: ActionDto[];

  @ApiPropertyOptional({
    description: 'Sliding time window for aggregation-based rules',
    type: () => WindowDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WindowDto)
  window?: WindowDto;

  @ApiPropertyOptional({
    description: 'Evaluation priority (higher = evaluated first)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether the version is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Activation datetime (defaults to now)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  activatedAt?: string;
}

/**
 * DTO for deactivating a rule version.
 */
export class DeactivateRuleVersionDto {
  @ApiPropertyOptional({
    description: 'Deactivation datetime (defaults to now)',
    example: '2026-02-13T12:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  deactivatedAt?: string;
}

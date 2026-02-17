import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for group condition in a rule definition.
 * Requires `min` signatures from a specific `group`.
 */
export class GroupConditionDto {
  @ApiProperty({ description: 'Signer group code', example: 'A' })
  @IsString()
  group: string;

  @ApiProperty({ description: 'Minimum signatures required', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  min: number;
}

/**
 * DTO for rule definition.
 * Supports AND/OR combinatory logic with nested conditions.
 *
 * Examples:
 * - Simple OR: { "any": [{ "group": "A", "min": 1 }, { "group": "B", "min": 2 }] }
 * - Simple AND: { "all": [{ "group": "A", "min": 1 }, { "group": "B", "min": 1 }] }
 * - Nested: { "any": [{ "all": [{ "group": "A", "min": 1 }, { "group": "B", "min": 1 }] }, { "group": "C", "min": 2 }] }
 */
export class RuleDefinitionDto {
  @ApiPropertyOptional({ description: 'Signer group code (leaf node)', example: 'A' })
  @IsOptional()
  @IsString()
  group?: string;

  @ApiPropertyOptional({ description: 'Minimum signatures from group', example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  min?: number;

  @ApiPropertyOptional({
    description: 'AND combinator — all conditions must be met',
    type: () => [RuleDefinitionDto],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RuleDefinitionDto)
  all?: RuleDefinitionDto[];

  @ApiPropertyOptional({
    description: 'OR combinator — any condition suffices',
    type: () => [RuleDefinitionDto],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RuleDefinitionDto)
  any?: RuleDefinitionDto[];
}

/**
 * DTO for creating a new signature rule.
 */
export class CreateSignatureRuleDto {
  @ApiProperty({ description: 'Signature schema UUID' })
  @IsUUID()
  idSignatureSchema: string;

  @ApiProperty({ description: 'Faculty UUID' })
  @IsUUID()
  idFaculty: string;

  @ApiProperty({ description: 'Rule name', example: 'Payment Approval Rule' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Human-readable description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the rule is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Evaluation priority (lower = higher priority)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiProperty({
    description: 'Authorization rule definition with AND/OR combinators',
    type: () => RuleDefinitionDto,
  })
  @ValidateNested()
  @Type(() => RuleDefinitionDto)
  ruleDefinition: RuleDefinitionDto;
}

/**
 * DTO for updating an existing signature rule.
 */
export class UpdateSignatureRuleDto {
  @ApiPropertyOptional({ description: 'Rule name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Human-readable description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the rule is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Evaluation priority', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Authorization rule definition',
    type: () => RuleDefinitionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleDefinitionDto)
  ruleDefinition?: RuleDefinitionDto;
}

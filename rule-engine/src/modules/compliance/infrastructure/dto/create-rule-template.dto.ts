import { IsString, IsOptional, IsBoolean, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new rule template.
 */
export class CreateRuleTemplateDto {
  @ApiProperty({ description: 'Unique rule code', example: 'HIGH_AMOUNT', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  code: string;

  @ApiProperty({
    description: 'Human-readable name',
    example: 'High Amount Transaction',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Description of the rule template' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Category (e.g. AML, FRAUD)',
    example: 'AML',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: 'Whether the template is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Mark as a system/base template (cannot be a child)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @ApiPropertyOptional({
    description: 'UUID of the parent template for inheritance',
    example: '00000000-0000-4000-b000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  parentTemplateId?: string;
}

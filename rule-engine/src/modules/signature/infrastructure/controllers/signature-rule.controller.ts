import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { SignatureRuleService } from '../../application';
import { CreateSignatureRuleDto, UpdateSignatureRuleDto } from '../dto';
import { RuleDefinition } from '../../domain/value-objects/rule-definition.vo';
import { OrganizationGuard, OrgContext, OrganizationContext } from '../../../../shared/guards';
import { EntityNotFoundException, ValidationException } from '../../../../shared/exceptions';

/**
 * Controller for managing signature rules.
 * All endpoints require organization context via x-organization-id header.
 */
@ApiTags('Signature Rules')
@Controller('signature-rules')
@UseGuards(OrganizationGuard)
export class SignatureRuleController {
  constructor(private readonly signatureRuleService: SignatureRuleService) {}

  /**
   * Create a new signature rule.
   *
   * POST /signature-rules
   *
   * Body:
   * {
   *   "idSignatureSchema": "uuid",
   *   "idFaculty": "uuid",
   *   "name": "Payment Rule",
   *   "description": "Optional description",
   *   "isActive": true,
   *   "priority": 0,
   *   "ruleDefinition": {
   *     "any": [
   *       { "group": "A", "min": 1 },
   *       { "group": "B", "min": 2 }
   *     ]
   *   }
   * }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create signature rule',
    description:
      'Creates a new authorization rule with AND/OR combinators for a schema and faculty',
  })
  @ApiCreatedResponse({ description: 'Signature rule created' })
  async create(@OrgContext() ctx: OrganizationContext, @Body() dto: CreateSignatureRuleDto) {
    const rule = await this.signatureRuleService.create({
      idOrganization: ctx.organizationId,
      idSignatureSchema: dto.idSignatureSchema,
      idFaculty: dto.idFaculty,
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive,
      priority: dto.priority,
      ruleDefinition: dto.ruleDefinition as RuleDefinition,
      createdBy: ctx.userId,
    });

    return {
      success: true,
      data: rule,
    };
  }

  /**
   * Get a signature rule by ID.
   *
   * GET /signature-rules/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get signature rule by ID' })
  @ApiParam({ name: 'id', description: 'Signature rule UUID' })
  @ApiOkResponse({ description: 'Signature rule details' })
  @ApiNotFoundResponse({ description: 'Rule not found' })
  async findById(@OrgContext() ctx: OrganizationContext, @Param('id') id: string) {
    const rule = await this.signatureRuleService.findById(id, ctx.organizationId);

    if (!rule) {
      throw new EntityNotFoundException('SignatureRule', id);
    }

    return {
      success: true,
      data: rule,
    };
  }

  /**
   * Get all rules for a schema.
   *
   * GET /signature-rules?schemaId=uuid
   * GET /signature-rules?schemaId=uuid&facultyId=uuid
   */
  @Get()
  @ApiOperation({
    summary: 'List rules by schema',
    description: 'Returns all rules for a schema, optionally filtered by faculty',
  })
  @ApiQuery({ name: 'schemaId', required: true, description: 'Signature schema UUID' })
  @ApiQuery({ name: 'facultyId', required: false, description: 'Filter by faculty UUID' })
  @ApiOkResponse({ description: 'List of signature rules' })
  async findBySchema(
    @OrgContext() ctx: OrganizationContext,
    @Query('schemaId') schemaId: string,
    @Query('facultyId') facultyId?: string,
  ) {
    if (!schemaId) {
      throw new ValidationException('schemaId query parameter is required');
    }

    let rules;
    if (facultyId) {
      rules = await this.signatureRuleService.findBySchemaAndFaculty(
        schemaId,
        facultyId,
        ctx.organizationId,
      );
    } else {
      rules = await this.signatureRuleService.findBySchema(schemaId, ctx.organizationId);
    }

    return {
      success: true,
      data: rules,
    };
  }

  /**
   * Update a signature rule.
   *
   * PUT /signature-rules/:id
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update signature rule' })
  @ApiParam({ name: 'id', description: 'Signature rule UUID' })
  @ApiOkResponse({ description: 'Updated signature rule' })
  async update(
    @OrgContext() ctx: OrganizationContext,
    @Param('id') id: string,
    @Body() dto: UpdateSignatureRuleDto,
  ) {
    const rule = await this.signatureRuleService.update(id, ctx.organizationId, {
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive,
      priority: dto.priority,
      ruleDefinition: dto.ruleDefinition as RuleDefinition,
      updatedBy: ctx.userId,
    });

    return {
      success: true,
      data: rule,
    };
  }

  /**
   * Delete a signature rule (soft delete).
   *
   * DELETE /signature-rules/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete signature rule', description: 'Soft-deletes a signature rule' })
  @ApiParam({ name: 'id', description: 'Signature rule UUID' })
  @ApiNoContentResponse({ description: 'Rule deleted' })
  async delete(@OrgContext() ctx: OrganizationContext, @Param('id') id: string) {
    await this.signatureRuleService.delete(id, ctx.organizationId, ctx.userId);
  }

  /**
   * Get all possible signature combinations for a rule.
   * Useful for displaying what combinations can satisfy the rule.
   *
   * GET /signature-rules/:id/combinations
   */
  @Get(':id/combinations')
  @ApiOperation({
    summary: 'Get valid signature combinations',
    description: 'Returns all possible signature combinations that satisfy the rule',
  })
  @ApiParam({ name: 'id', description: 'Signature rule UUID' })
  @ApiOkResponse({ description: 'List of valid signature combinations' })
  async getCombinations(@OrgContext() ctx: OrganizationContext, @Param('id') id: string) {
    const combinations = await this.signatureRuleService.getPossibleCombinations(
      id,
      ctx.organizationId,
    );

    return {
      success: true,
      data: combinations,
    };
  }
}

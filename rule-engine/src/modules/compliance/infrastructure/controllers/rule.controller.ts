import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { RuleTemplateService, RuleVersionService } from '../../application';
import { CreateRuleTemplateDto, CreateRuleVersionDto, DeactivateRuleVersionDto } from '../dto';
import { OrganizationGuard, OrgContext, OrganizationContext } from '../../../../shared/guards';
import { EntityNotFoundException } from '../../../../shared/exceptions';
import { ConditionNode } from '../../domain/value-objects/condition-node.vo';
import { ActionDefinition } from '../../domain/value-objects/action-definition.vo';
import { WindowSpec } from '../../domain/value-objects/window-spec.vo';

/**
 * Controller for managing compliance rule templates and versions.
 *
 * Templates:
 *   POST   /rule-templates         → create template
 *   GET    /rule-templates         → list templates
 *   GET    /rule-templates/:id     → get template
 *   PUT    /rule-templates/:id/deactivate → deactivate template
 *
 * Versions:
 *   POST   /rule-templates/:id/versions           → create version
 *   GET    /rule-templates/:id/versions           → list versions for template
 *   GET    /rule-versions/:id                      → get version by id
 *   GET    /rule-versions/active                   → get all active versions
 *   PUT    /rule-versions/:id/deactivate          → deactivate version
 */
@Controller()
@UseGuards(OrganizationGuard)
export class RuleController {
  constructor(
    private readonly ruleTemplateService: RuleTemplateService,
    private readonly ruleVersionService: RuleVersionService,
  ) {}

  // ─── Templates ──────────────────────────────────────────────────────

  @Post('rule-templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Rule Templates')
  @ApiOperation({
    summary: 'Create rule template',
    description: 'Creates a new compliance rule template',
  })
  @ApiCreatedResponse({ description: 'Rule template created' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  async createTemplate(@OrgContext() ctx: OrganizationContext, @Body() dto: CreateRuleTemplateDto) {
    const template = await this.ruleTemplateService.create({
      idOrganization: ctx.organizationId,
      code: dto.code,
      name: dto.name,
      description: dto.description,
      category: dto.category,
      isActive: dto.isActive,
      isSystem: dto.isSystem,
      parentTemplateId: dto.parentTemplateId,
      createdBy: ctx.userId,
    });

    return { success: true, data: template };
  }

  @Get('rule-templates')
  @ApiTags('Rule Templates')
  @ApiOperation({
    summary: 'List rule templates',
    description: 'Returns all rule templates for the organization',
  })
  @ApiOkResponse({ description: 'List of rule templates' })
  async findAllTemplates(@OrgContext() ctx: OrganizationContext) {
    const templates = await this.ruleTemplateService.findAll(ctx.organizationId);

    return {
      success: true,
      data: templates,
      count: templates.length,
    };
  }

  @Get('rule-templates/:id')
  @ApiTags('Rule Templates')
  @ApiOperation({ summary: 'Get rule template by ID' })
  @ApiParam({ name: 'id', description: 'Rule template UUID' })
  @ApiOkResponse({ description: 'Rule template details' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  async findTemplateById(@OrgContext() ctx: OrganizationContext, @Param('id') id: string) {
    const template = await this.ruleTemplateService.findById(id, ctx.organizationId);

    if (!template) {
      throw new EntityNotFoundException('RuleTemplate', id);
    }

    return { success: true, data: template };
  }

  @Put('rule-templates/:id/deactivate')
  @ApiTags('Rule Templates')
  @ApiOperation({
    summary: 'Deactivate rule template',
    description: 'Deactivates a template (soft disable, no new versions allowed)',
  })
  @ApiParam({ name: 'id', description: 'Rule template UUID' })
  @ApiOkResponse({ description: 'Deactivated template' })
  async deactivateTemplate(@OrgContext() ctx: OrganizationContext, @Param('id') id: string) {
    const template = await this.ruleTemplateService.deactivate(id, ctx.organizationId, ctx.userId);

    return { success: true, data: template };
  }

  // ─── Versions ───────────────────────────────────────────────────────

  @Post('rule-templates/:templateId/versions')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Rule Versions')
  @ApiOperation({
    summary: 'Create rule version',
    description:
      'Creates an immutable version for a template. Auto-deactivates the previous active version.',
  })
  @ApiParam({ name: 'templateId', description: 'Rule template UUID' })
  @ApiCreatedResponse({ description: 'Rule version created' })
  @ApiUnprocessableEntityResponse({ description: 'Template is inactive' })
  async createVersion(
    @OrgContext() ctx: OrganizationContext,
    @Param('templateId') templateId: string,
    @Body() dto: CreateRuleVersionDto,
  ) {
    const version = await this.ruleVersionService.create({
      idOrganization: ctx.organizationId,
      idRuleTemplate: templateId,
      conditions: dto.conditions as unknown as ConditionNode,
      actions: dto.actions as ActionDefinition[],
      window: dto.window as WindowSpec | undefined,
      priority: dto.priority,
      enabled: dto.enabled,
      activatedAt: dto.activatedAt ? new Date(dto.activatedAt) : undefined,
      createdBy: ctx.userId,
    });

    return { success: true, data: version };
  }

  @Get('rule-templates/:templateId/versions')
  @ApiTags('Rule Versions')
  @ApiOperation({
    summary: 'List versions for template',
    description: 'Returns all versions (active and deactivated) for a specific template',
  })
  @ApiParam({ name: 'templateId', description: 'Rule template UUID' })
  @ApiOkResponse({ description: 'List of rule versions' })
  async findVersionsByTemplate(
    @OrgContext() ctx: OrganizationContext,
    @Param('templateId') templateId: string,
  ) {
    const versions = await this.ruleVersionService.findByTemplate(templateId, ctx.organizationId);

    return {
      success: true,
      data: versions,
      count: versions.length,
    };
  }

  @Get('rule-versions/active')
  @ApiTags('Rule Versions')
  @ApiOperation({
    summary: 'List active rule versions',
    description: 'Returns all currently active (non-deactivated) rule versions',
  })
  @ApiOkResponse({ description: 'List of active rule versions' })
  async findActiveVersions(@OrgContext() ctx: OrganizationContext) {
    const versions = await this.ruleVersionService.findActiveVersions(ctx.organizationId);

    return {
      success: true,
      data: versions,
      count: versions.length,
    };
  }

  @Get('rule-versions/:id')
  @ApiTags('Rule Versions')
  @ApiOperation({ summary: 'Get rule version by ID' })
  @ApiParam({ name: 'id', description: 'Rule version UUID' })
  @ApiOkResponse({ description: 'Rule version details' })
  @ApiNotFoundResponse({ description: 'Version not found' })
  async findVersionById(@OrgContext() ctx: OrganizationContext, @Param('id') id: string) {
    const version = await this.ruleVersionService.findById(id, ctx.organizationId);

    if (!version) {
      throw new EntityNotFoundException('RuleVersion', id);
    }

    return { success: true, data: version };
  }

  @Put('rule-versions/:id/deactivate')
  @ApiTags('Rule Versions')
  @ApiOperation({
    summary: 'Deactivate rule version',
    description: 'Deactivates a version so it is no longer evaluated against new transactions',
  })
  @ApiParam({ name: 'id', description: 'Rule version UUID' })
  @ApiOkResponse({ description: 'Deactivated version' })
  async deactivateVersion(
    @OrgContext() ctx: OrganizationContext,
    @Param('id') id: string,
    @Body() dto: DeactivateRuleVersionDto,
  ) {
    const version = await this.ruleVersionService.deactivate(
      id,
      ctx.organizationId,
      dto.deactivatedAt ? new Date(dto.deactivatedAt) : undefined,
    );

    return { success: true, data: version };
  }
}

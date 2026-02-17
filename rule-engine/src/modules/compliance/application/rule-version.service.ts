import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { RuleVersion, RuleTemplate } from '../domain';
import { ConditionNode } from '../domain/value-objects/condition-node.vo';
import { ActionDefinition } from '../domain/value-objects/action-definition.vo';
import { WindowSpec } from '../domain/value-objects/window-spec.vo';
import {
  EntityNotFoundException,
  ValidationException,
  BusinessRuleException,
} from '../../../shared/exceptions';
import { RuleTemplateService } from './rule-template.service';
import { RedisCacheService } from '../../../shared/cache';
import { ConditionStructureValidator } from '../domain/services/condition-structure-validator.service';

export interface CreateRuleVersionInput {
  idOrganization: string;
  idRuleTemplate: string;
  conditions: ConditionNode;
  actions: ActionDefinition[];
  window?: WindowSpec;
  priority?: number;
  enabled?: boolean;
  activatedAt?: Date;
  createdBy?: string;
}

/**
 * Application service for managing rule versions.
 *
 * Rule versions are IMMUTABLE snapshots. Creating a new version:
 *   1. Validates the template exists
 *   2. Resolves inherited conditions from parent templates
 *   3. Computes the next version number
 *   4. Optionally auto-deactivates the previous active version
 *   5. Creates the new immutable version
 */
@Injectable()
export class RuleVersionService {
  constructor(
    @InjectRepository(RuleVersion)
    private readonly versionRepository: Repository<RuleVersion>,
    @InjectRepository(RuleTemplate)
    private readonly templateRepository: Repository<RuleTemplate>,
    private readonly ruleTemplateService: RuleTemplateService,
    private readonly cacheService: RedisCacheService,
  ) {}

  async create(input: CreateRuleVersionInput): Promise<RuleVersion> {
    // 1. Validate template exists
    const template = await this.templateRepository.findOne({
      where: {
        id: input.idRuleTemplate,
        idOrganization: input.idOrganization,
      } as FindOptionsWhere<RuleTemplate>,
    });

    if (!template) {
      throw new EntityNotFoundException('RuleTemplate', input.idRuleTemplate);
    }

    if (!template.isActive) {
      throw new BusinessRuleException(
        `Cannot create version for inactive template "${template.code}"`,
      );
    }

    // Structural validation for condition tree (lightweight JSON-shape guard)
    const initialValidation = ConditionStructureValidator.validate(input.conditions);
    if (!initialValidation.valid) {
      throw new ValidationException('Invalid rule conditions structure', {
        conditions: initialValidation.errors,
      });
    }

    // 2. Resolve effective conditions (merge parent conditions if inheritance exists)
    let effectiveConditions = input.conditions;

    if (template.parentTemplateId) {
      effectiveConditions = await this.resolveEffectiveConditions(
        template,
        input.conditions,
        input.idOrganization,
      );
    }

    // Validate merged conditions too (in case inherited parent conditions are malformed)
    const mergedValidation = ConditionStructureValidator.validate(effectiveConditions);
    if (!mergedValidation.valid) {
      throw new ValidationException('Invalid merged rule conditions structure', {
        conditions: mergedValidation.errors,
      });
    }

    // 3. Compute next version number
    const latestVersion = await this.versionRepository
      .createQueryBuilder('rv')
      .where('rv.id_rule_template = :templateId', { templateId: input.idRuleTemplate })
      .andWhere('rv.id_organization = :orgId', { orgId: input.idOrganization })
      .orderBy('rv.version_number', 'DESC')
      .getOne();

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // 4. Auto-deactivate previous active version for this template
    if (input.enabled !== false) {
      await this.versionRepository
        .createQueryBuilder()
        .update(RuleVersion)
        .set({ deactivatedAt: new Date() })
        .where('id_rule_template = :templateId', { templateId: input.idRuleTemplate })
        .andWhere('id_organization = :orgId', { orgId: input.idOrganization })
        .andWhere('deactivated_at IS NULL')
        .execute();
    }

    // 5. Create immutable version with effective (merged) conditions
    const version = this.versionRepository.create({
      idOrganization: input.idOrganization,
      idRuleTemplate: input.idRuleTemplate,
      versionNumber: nextVersionNumber,
      conditions: effectiveConditions,
      actions: input.actions,
      window: input.window || null,
      priority: input.priority ?? 0,
      enabled: input.enabled ?? true,
      activatedAt: input.activatedAt || new Date(),
      deactivatedAt: null,
      createdBy: input.createdBy || null,
    });

    const saved = await this.versionRepository.save(version);

    // Invalidate cached active rules so next evaluation picks up the change
    await this.cacheService.invalidateActiveRules(input.idOrganization);

    return saved;
  }

  /**
   * Merge parent condition trees with child conditions.
   * Strategy: wrap in a top-level { all: [parentConditions, childConditions] }
   * so the child extends the parent deterministically.
   */
  private async resolveEffectiveConditions(
    template: RuleTemplate,
    childConditions: ConditionNode,
    idOrganization: string,
  ): Promise<ConditionNode> {
    // Get the active version of the parent template to extract its conditions
    const parentVersion = await this.versionRepository.findOne({
      where: {
        idRuleTemplate: template.parentTemplateId!,
        idOrganization,
        enabled: true,
        deactivatedAt: IsNull(),
      } as FindOptionsWhere<RuleVersion>,
      order: { versionNumber: 'DESC' },
    });

    if (!parentVersion) {
      // No active parent version — use child conditions as-is
      return childConditions;
    }

    // Merge: { all: [parentConditions, childConditions] }
    return {
      all: [parentVersion.conditions, childConditions],
    } as ConditionNode;
  }

  async findById(id: string, idOrganization: string): Promise<RuleVersion | null> {
    return this.versionRepository.findOne({
      where: { id, idOrganization } as FindOptionsWhere<RuleVersion>,
      relations: ['template'],
    });
  }

  async findActiveVersions(idOrganization: string): Promise<RuleVersion[]> {
    return this.versionRepository.find({
      where: {
        idOrganization,
        enabled: true,
        deactivatedAt: IsNull(),
      } as FindOptionsWhere<RuleVersion>,
      relations: ['template'],
      order: { priority: 'ASC' },
    });
  }

  async findByTemplate(idRuleTemplate: string, idOrganization: string): Promise<RuleVersion[]> {
    return this.versionRepository.find({
      where: {
        idRuleTemplate,
        idOrganization,
      } as FindOptionsWhere<RuleVersion>,
      order: { versionNumber: 'DESC' },
    });
  }

  async deactivate(id: string, idOrganization: string, deactivatedAt?: Date): Promise<RuleVersion> {
    const version = await this.versionRepository.findOne({
      where: { id, idOrganization } as FindOptionsWhere<RuleVersion>,
    });

    if (!version) {
      throw new EntityNotFoundException('RuleVersion', id);
    }

    if (version.deactivatedAt) {
      throw new BusinessRuleException('Rule version is already deactivated');
    }

    version.deactivatedAt = deactivatedAt || new Date();

    const saved = await this.versionRepository.save(version);

    // Invalidate cached active rules
    await this.cacheService.invalidateActiveRules(idOrganization);

    return saved;
  }
}

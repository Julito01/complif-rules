import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { RuleTemplate } from '../domain';
import {
  EntityNotFoundException,
  ValidationException,
  BusinessRuleException,
} from '../../../shared/exceptions';

export interface CreateRuleTemplateInput {
  idOrganization: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  isActive?: boolean;
  isSystem?: boolean;
  parentTemplateId?: string;
  createdBy?: string;
}

/**
 * Application service for managing rule templates.
 *
 * Rule templates are the identity layer for compliance rules.
 * They define "what" the rule is; RuleVersions define "how" it evaluates.
 *
 * Supports inheritance: child templates can reference a parent.
 */
@Injectable()
export class RuleTemplateService {
  constructor(
    @InjectRepository(RuleTemplate)
    private readonly templateRepository: Repository<RuleTemplate>,
  ) {}

  async create(input: CreateRuleTemplateInput): Promise<RuleTemplate> {
    // Check for duplicate code within org
    const existing = await this.templateRepository.findOne({
      where: {
        idOrganization: input.idOrganization,
        code: input.code,
      } as FindOptionsWhere<RuleTemplate>,
    });

    if (existing) {
      throw new ValidationException(
        `Rule template with code "${input.code}" already exists in this organization`,
      );
    }

    // Validate system template constraints
    if (input.isSystem && input.parentTemplateId) {
      throw new ValidationException('System templates cannot have a parent template');
    }

    // Enforce baseline presence before creating non-system templates.
    // Baseline = active system template with no parent.
    const isBaselineCreation = !!input.isSystem && !input.parentTemplateId;
    if (!isBaselineCreation) {
      await this.ensureBaselineExists(input.idOrganization);
    }

    // Validate parent template if specified
    if (input.parentTemplateId) {
      const parent = await this.templateRepository.findOne({
        where: {
          id: input.parentTemplateId,
          idOrganization: input.idOrganization,
        } as FindOptionsWhere<RuleTemplate>,
      });

      if (!parent) {
        throw new EntityNotFoundException('Parent RuleTemplate', input.parentTemplateId);
      }

      if (!parent.isActive) {
        throw new BusinessRuleException(`Cannot inherit from inactive template "${parent.code}"`);
      }

      // Detect circular inheritance (parent -> grandparent -> ...)
      await this.validateNoCycle(input.parentTemplateId, input.idOrganization);
    }

    const template = this.templateRepository.create({
      idOrganization: input.idOrganization,
      code: input.code,
      name: input.name,
      description: input.description || null,
      category: input.category || null,
      isActive: input.isActive ?? true,
      isSystem: input.isSystem ?? false,
      parentTemplateId: input.parentTemplateId || null,
      createdBy: input.createdBy || null,
    });

    return this.templateRepository.save(template);
  }

  async findById(id: string, idOrganization: string): Promise<RuleTemplate | null> {
    return this.templateRepository.findOne({
      where: { id, idOrganization } as FindOptionsWhere<RuleTemplate>,
      relations: ['versions', 'parentTemplate'],
    });
  }

  async findAll(idOrganization: string): Promise<RuleTemplate[]> {
    return this.templateRepository.find({
      where: { idOrganization } as FindOptionsWhere<RuleTemplate>,
      relations: ['versions'],
      order: { code: 'ASC' },
    });
  }

  async deactivate(id: string, idOrganization: string, updatedBy?: string): Promise<RuleTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id, idOrganization } as FindOptionsWhere<RuleTemplate>,
    });

    if (!template) {
      throw new EntityNotFoundException('RuleTemplate', id);
    }

    const isBaseline = template.isSystem && !template.parentTemplateId;
    if (isBaseline && template.isActive) {
      const baselineCount = await this.countActiveBaselines(idOrganization);
      if (baselineCount <= 1) {
        throw new BusinessRuleException(
          'Cannot deactivate the last active baseline template for this organization',
          'BASELINE_REQUIRED',
        );
      }
    }

    template.isActive = false;
    template.updatedBy = updatedBy || null;

    return this.templateRepository.save(template);
  }

  /**
   * Resolve the parent chain and return the merged condition tree.
   * Walks up parent → grandparent → ... until root.
   * Returns conditions from all ancestors in order [root, ..., parent].
   */
  async resolveInheritanceChain(
    templateId: string,
    idOrganization: string,
  ): Promise<RuleTemplate[]> {
    const chain: RuleTemplate[] = [];
    let currentId: string | null = templateId;

    // Walk up the parent chain (max 10 levels to prevent infinite loops)
    for (let depth = 0; depth < 10 && currentId; depth++) {
      const template = await this.templateRepository.findOne({
        where: { id: currentId, idOrganization } as FindOptionsWhere<RuleTemplate>,
      });

      if (!template) break;
      chain.push(template);
      currentId = template.parentTemplateId;
    }

    // Reverse so root is first: [root, ..., parent, child]
    return chain.reverse();
  }

  /**
   * Ensure adding a parent doesn't create a cycle.
   * Walks the parent chain from the given parentId upward.
   */
  private async validateNoCycle(
    parentTemplateId: string,
    idOrganization: string,
    maxDepth = 10,
  ): Promise<void> {
    const visited = new Set<string>();
    let currentId: string | null = parentTemplateId;

    for (let depth = 0; depth < maxDepth && currentId; depth++) {
      if (visited.has(currentId)) {
        throw new BusinessRuleException('Circular inheritance detected in template chain');
      }
      visited.add(currentId);

      const template = await this.templateRepository.findOne({
        where: { id: currentId, idOrganization } as FindOptionsWhere<RuleTemplate>,
      });

      if (!template) break;
      currentId = template.parentTemplateId;
    }
  }

  private async ensureBaselineExists(idOrganization: string): Promise<void> {
    const baselineCount = await this.countActiveBaselines(idOrganization);
    if (baselineCount === 0) {
      throw new BusinessRuleException(
        'At least one active baseline template is required before creating non-system templates',
        'BASELINE_REQUIRED',
      );
    }
  }

  private async countActiveBaselines(idOrganization: string): Promise<number> {
    return this.templateRepository.count({
      where: {
        idOrganization,
        isActive: true,
        isSystem: true,
        parentTemplateId: IsNull(),
      } as FindOptionsWhere<RuleTemplate>,
    });
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { SignatureRule, SignatureSchema, Faculty } from '../domain';
import { RuleDefinition } from '../domain/value-objects/rule-definition.vo';
import { RuleEvaluator } from '../domain/services/rule-evaluator.service';
import { EntityNotFoundException, ValidationException } from '../../../shared/exceptions';

export interface CreateSignatureRuleInput {
  idOrganization: string;
  idSignatureSchema: string;
  idFaculty: string;
  name: string;
  description?: string;
  isActive?: boolean;
  priority?: number;
  ruleDefinition: RuleDefinition;
  createdBy?: string;
}

export interface UpdateSignatureRuleInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  priority?: number;
  ruleDefinition?: RuleDefinition;
  updatedBy?: string;
}

/**
 * Application service for managing signature rules.
 *
 * Signature rules define the authorization combinatorics for a specific
 * faculty within a signature schema. Each rule contains AND/OR logic
 * specifying which signer groups and minimum counts are required.
 */
@Injectable()
export class SignatureRuleService {
  constructor(
    @InjectRepository(SignatureRule)
    private readonly ruleRepository: Repository<SignatureRule>,
    @InjectRepository(SignatureSchema)
    private readonly schemaRepository: Repository<SignatureSchema>,
    @InjectRepository(Faculty)
    private readonly facultyRepository: Repository<Faculty>,
  ) {}

  /**
   * Create a new signature rule.
   */
  async create(input: CreateSignatureRuleInput): Promise<SignatureRule> {
    // Validate that the schema exists and belongs to the organization
    const schema = await this.schemaRepository.findOne({
      where: {
        id: input.idSignatureSchema,
        idOrganization: input.idOrganization,
      } as FindOptionsWhere<SignatureSchema>,
    });

    if (!schema) {
      throw new EntityNotFoundException('SignatureSchema', input.idSignatureSchema);
    }

    // Validate that the faculty exists and belongs to the organization
    const faculty = await this.facultyRepository.findOne({
      where: {
        id: input.idFaculty,
        idOrganization: input.idOrganization,
      } as FindOptionsWhere<Faculty>,
    });

    if (!faculty) {
      throw new EntityNotFoundException('Faculty', input.idFaculty);
    }

    // Validate the rule definition structure
    this.validateRuleDefinition(input.ruleDefinition);

    const rule = this.ruleRepository.create({
      idOrganization: input.idOrganization,
      idSignatureSchema: input.idSignatureSchema,
      idFaculty: input.idFaculty,
      name: input.name,
      description: input.description || null,
      isActive: input.isActive ?? true,
      priority: input.priority ?? 0,
      ruleDefinition: input.ruleDefinition,
      createdBy: input.createdBy || null,
    });

    return this.ruleRepository.save(rule);
  }

  /**
   * Update an existing signature rule.
   */
  async update(
    id: string,
    idOrganization: string,
    input: UpdateSignatureRuleInput,
  ): Promise<SignatureRule> {
    const rule = await this.ruleRepository.findOne({
      where: {
        id,
        idOrganization,
      } as FindOptionsWhere<SignatureRule>,
    });

    if (!rule) {
      throw new EntityNotFoundException('SignatureRule', id);
    }

    // Validate the rule definition if provided
    if (input.ruleDefinition) {
      this.validateRuleDefinition(input.ruleDefinition);
    }

    // Update fields
    if (input.name !== undefined) {
      rule.name = input.name;
    }
    if (input.description !== undefined) {
      rule.description = input.description;
    }
    if (input.isActive !== undefined) {
      rule.isActive = input.isActive;
    }
    if (input.priority !== undefined) {
      rule.priority = input.priority;
    }
    if (input.ruleDefinition !== undefined) {
      rule.ruleDefinition = input.ruleDefinition;
    }
    if (input.updatedBy !== undefined) {
      rule.updatedBy = input.updatedBy;
    }

    return this.ruleRepository.save(rule);
  }

  /**
   * Find a rule by ID.
   */
  async findById(id: string, idOrganization: string): Promise<SignatureRule | null> {
    return this.ruleRepository.findOne({
      where: {
        id,
        idOrganization,
      } as FindOptionsWhere<SignatureRule>,
      relations: ['schema', 'faculty'],
    });
  }

  /**
   * Find all rules for a schema.
   */
  async findBySchema(idSignatureSchema: string, idOrganization: string): Promise<SignatureRule[]> {
    return this.ruleRepository.find({
      where: {
        idSignatureSchema,
        idOrganization,
      } as FindOptionsWhere<SignatureRule>,
      relations: ['faculty'],
      order: {
        priority: 'ASC',
        name: 'ASC',
      },
    });
  }

  /**
   * Find all rules for a faculty within a schema.
   */
  async findBySchemaAndFaculty(
    idSignatureSchema: string,
    idFaculty: string,
    idOrganization: string,
  ): Promise<SignatureRule[]> {
    return this.ruleRepository.find({
      where: {
        idSignatureSchema,
        idFaculty,
        idOrganization,
        isActive: true,
      } as FindOptionsWhere<SignatureRule>,
      order: {
        priority: 'ASC',
      },
    });
  }

  /**
   * Soft delete a rule.
   */
  async delete(id: string, idOrganization: string, deletedBy?: string): Promise<void> {
    const rule = await this.ruleRepository.findOne({
      where: {
        id,
        idOrganization,
      } as FindOptionsWhere<SignatureRule>,
    });

    if (!rule) {
      throw new EntityNotFoundException('SignatureRule', id);
    }

    rule.deletedBy = deletedBy || null;
    await this.ruleRepository.save(rule);
    await this.ruleRepository.softDelete(id);
  }

  /**
   * Get all possible signature combinations for a rule.
   * Useful for displaying what combinations can satisfy the rule.
   */
  async getPossibleCombinations(id: string, idOrganization: string) {
    const rule = await this.findById(id, idOrganization);

    if (!rule) {
      throw new EntityNotFoundException('SignatureRule', id);
    }

    return RuleEvaluator.getPossibleCombinations(rule.ruleDefinition);
  }

  /**
   * Validate that a rule definition has valid structure.
   */
  private validateRuleDefinition(definition: RuleDefinition): void {
    if (!definition) {
      throw new ValidationException('Rule definition is required');
    }

    // Check if it's a valid type
    const isGroup = 'group' in definition && 'min' in definition;
    const isAll = 'all' in definition;
    const isAny = 'any' in definition;

    if (!isGroup && !isAll && !isAny) {
      throw new ValidationException(
        'Invalid rule definition: must be a group condition (group + min), ' +
          'an ALL condition (all: [...]), or an ANY condition (any: [...])',
      );
    }

    // Validate group condition
    if (isGroup) {
      const groupDef = definition as { group: string; min: number };
      if (typeof groupDef.group !== 'string' || groupDef.group.trim() === '') {
        throw new ValidationException('Invalid rule definition: group must be a non-empty string');
      }
      if (typeof groupDef.min !== 'number' || groupDef.min < 1) {
        throw new ValidationException('Invalid rule definition: min must be a positive integer');
      }
    }

    // Recursively validate nested conditions
    if (isAll) {
      const allDef = definition as { all: RuleDefinition[] };
      if (!Array.isArray(allDef.all) || allDef.all.length === 0) {
        throw new ValidationException('Invalid rule definition: all must be a non-empty array');
      }
      for (const child of allDef.all) {
        this.validateRuleDefinition(child);
      }
    }

    if (isAny) {
      const anyDef = definition as { any: RuleDefinition[] };
      if (!Array.isArray(anyDef.any) || anyDef.any.length === 0) {
        throw new ValidationException('Invalid rule definition: any must be a non-empty array');
      }
      for (const child of anyDef.any) {
        this.validateRuleDefinition(child);
      }
    }
  }
}

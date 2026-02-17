import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { RuleTemplate } from './rule-template.entity';
import { ConditionNode } from '../value-objects/condition-node.vo';
import { ActionDefinition } from '../value-objects/action-definition.vo';
import { WindowSpec } from '../value-objects/window-spec.vo';

/**
 * RuleVersion - immutable snapshot of a compliance rule.
 *
 * Rule versions are NEVER mutated after creation.
 * To change a rule, create a new version and deactivate the old one.
 *
 * Key invariant: only one active version per template at any time
 * (enforced via partial unique index on idRuleTemplate WHERE deactivated_at IS NULL).
 */
@Entity('rule_versions')
@Index('idx_rule_version_org_active', ['idOrganization', 'deactivatedAt'])
@Index('idx_rule_version_template', ['idRuleTemplate'])
@Index('idx_rule_version_org_enabled_active', ['idOrganization', 'enabled', 'deactivatedAt'])
export class RuleVersion extends BaseEntity {
  @Column({ name: 'id_rule_template', type: 'uuid' })
  idRuleTemplate: string;

  @ManyToOne(() => RuleTemplate, (template) => template.versions)
  @JoinColumn({ name: 'id_rule_template' })
  template: RuleTemplate;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ type: 'jsonb' })
  conditions: ConditionNode;

  @Column({ type: 'jsonb' })
  actions: ActionDefinition[];

  @Column({ type: 'jsonb', nullable: true })
  window: WindowSpec | null;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'activated_at', type: 'timestamp with time zone' })
  activatedAt: Date;

  @Column({ name: 'deactivated_at', type: 'timestamp with time zone', nullable: true })
  deactivatedAt: Date | null;
}

import { Entity, Column, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { RuleVersion } from './rule-version.entity';

/**
 * RuleTemplate - reusable blueprint for compliance rules.
 *
 * A template defines the identity and categorization of a rule.
 * Actual evaluation parameters live in RuleVersion (immutable snapshots).
 *
 * Supports single-level inheritance:
 *   - System templates (isSystem = true) are root baselines.
 *   - Child templates reference a parent via parentTemplateId.
 *   - When a child creates a version, conditions are merged: parent AND child.
 */
@Entity('rule_templates')
@Index('idx_rule_template_org_code', ['idOrganization', 'code'], { unique: true })
@Index('idx_rule_template_parent', ['parentTemplateId'])
export class RuleTemplate extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /**
   * Whether this is a system/base template. System templates cannot be children.
   */
  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  /**
   * Optional parent template ID for inheritance.
   * When set, rule versions merge parent conditions with child conditions.
   */
  @Column({ name: 'parent_template_id', type: 'uuid', nullable: true })
  parentTemplateId: string | null;

  @ManyToOne(() => RuleTemplate, { nullable: true })
  @JoinColumn({ name: 'parent_template_id' })
  parentTemplate: RuleTemplate | null;

  @OneToMany(() => RuleVersion, (version) => version.template)
  versions: RuleVersion[];
}

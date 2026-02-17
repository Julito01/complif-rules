import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { SignatureSchema } from './signature-schema.entity';
import { Faculty } from './faculty.entity';
import { RuleDefinition } from '../value-objects/rule-definition.vo';

/**
 * SignatureRule - defines one valid signer combination for a faculty.
 * The rule_definition contains the AND/OR combinatory logic.
 *
 * This is configuration, not runtime state.
 */
@Entity('signature_rules')
@Index('IDX_signature_rules_organization', ['idOrganization'])
@Index('IDX_signature_rules_schema', ['idSignatureSchema'])
@Index('IDX_signature_rules_faculty', ['idFaculty'])
@Index('IDX_signature_rules_schema_faculty_active', ['idSignatureSchema', 'idFaculty', 'isActive'])
export class SignatureRule extends BaseEntity {
  @Column({ name: 'id_signature_schema', type: 'uuid' })
  idSignatureSchema: string;

  @ManyToOne(() => SignatureSchema, (schema) => schema.rules)
  @JoinColumn({ name: 'id_signature_schema' })
  schema: SignatureSchema;

  @Column({ name: 'id_faculty', type: 'uuid' })
  idFaculty: string;

  @ManyToOne(() => Faculty)
  @JoinColumn({ name: 'id_faculty' })
  faculty: Faculty;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ default: 0 })
  priority: number;

  /**
   * JSON representation of the rule for evaluation.
   * Example: { "any": [{ "group": "A", "min": 1 }, { "group": "B", "min": 2 }] }
   */
  @Column({ name: 'rule_definition', type: 'jsonb' })
  ruleDefinition: RuleDefinition;
}

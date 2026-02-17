import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { ActionDefinition } from '../value-objects/action-definition.vo';
import { RuleEvaluationOutcome } from '../value-objects/evaluation-result.vo';

/**
 * EvaluationResult - immutable audit record of a transaction evaluation.
 *
 * Stores the full result of evaluating a transaction against all active rules.
 * Never mutated after creation — provides full auditability.
 */
@Entity('evaluation_results')
@Index('idx_evaluation_result_transaction', ['idTransaction'])
@Index('idx_evaluation_result_org_datetime', ['idOrganization', 'evaluatedAt'])
export class EvaluationResult extends BaseEntity {
  @Column({ name: 'id_transaction', type: 'uuid' })
  idTransaction: string;

  @Column({ name: 'id_account', type: 'uuid' })
  idAccount: string;

  @Column({ type: 'varchar', length: 10 })
  decision: string;

  @Column({ name: 'triggered_rules', type: 'jsonb' })
  triggeredRules: RuleEvaluationOutcome[];

  @Column({ name: 'all_rule_results', type: 'jsonb' })
  allRuleResults: RuleEvaluationOutcome[];

  @Column({ type: 'jsonb' })
  actions: ActionDefinition[];

  @Column({ name: 'evaluated_at', type: 'timestamp with time zone' })
  evaluatedAt: Date;

  @Column({ name: 'evaluation_duration_ms', type: 'int', nullable: true })
  evaluationDurationMs: number | null;
}

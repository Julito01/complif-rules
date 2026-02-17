/**
 * Evaluation Result - Value Object
 *
 * The output of evaluating a transaction against all active rules.
 * Immutable — created once, never modified.
 */
import { ActionDefinition, Decision } from './action-definition.vo';

/**
 * Per-rule evaluation outcome.
 */
export interface RuleEvaluationOutcome {
  /** The rule version that was evaluated */
  ruleVersionId: string;
  /** Whether the rule's conditions were satisfied */
  satisfied: boolean;
  /** The rule's priority */
  priority: number;
}

/**
 * Full evaluation result for a transaction.
 */
export interface EvaluationResultVO {
  /** Final decision: ALLOW, REVIEW, or BLOCK */
  decision: Decision;
  /** Rules that triggered (conditions satisfied) */
  triggeredRules: RuleEvaluationOutcome[];
  /** ALL rule results including non-triggered ones */
  allRuleResults: RuleEvaluationOutcome[];
  /** Collected actions from all triggered rules */
  actions: ActionDefinition[];
}

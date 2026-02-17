/**
 * Transaction Evaluation Engine - Domain Service
 *
 * Pure, stateless orchestrator that evaluates a transaction's facts
 * against multiple active rule versions and produces an EvaluationResult.
 *
 * No database, no side effects — pure computation.
 *
 * Decision resolution:
 *   - BLOCK: any triggered action is "block_transaction"
 *   - REVIEW: any triggered action is "create_alert" (no block)
 *   - ALLOW: no rules triggered
 */

import { ConditionNode } from '../value-objects/condition-node.vo';
import { ActionDefinition, Decision } from '../value-objects/action-definition.vo';
import { EvaluationResultVO, RuleEvaluationOutcome } from '../value-objects/evaluation-result.vo';
import { ConditionEvaluator } from './condition-evaluator.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types for input
// ─────────────────────────────────────────────────────────────────────────────

export interface RuleVersionForEval {
  id: string;
  idRuleTemplate: string;
  versionNumber: number;
  conditions: ConditionNode;
  actions: ActionDefinition[];
  priority: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine (static, pure)
// ─────────────────────────────────────────────────────────────────────────────

export class TransactionEvaluationEngine {
  /**
   * Evaluate a set of facts against all active rule versions.
   *
   * @param rules - Active rule versions, ideally pre-sorted by priority
   * @param facts - Transaction facts + aggregation facts (flat/nested object)
   * @returns Full evaluation result with decision, triggered rules, all outcomes, and actions
   */
  static evaluate(rules: RuleVersionForEval[], facts: Record<string, unknown>): EvaluationResultVO {
    const allRuleResults: RuleEvaluationOutcome[] = [];
    const triggeredRules: RuleEvaluationOutcome[] = [];
    const collectedActions: ActionDefinition[] = [];

    for (const rule of rules) {
      const satisfied = ConditionEvaluator.evaluate(rule.conditions, facts);

      const outcome: RuleEvaluationOutcome = {
        ruleVersionId: rule.id,
        satisfied,
        priority: rule.priority,
      };

      allRuleResults.push(outcome);

      if (satisfied) {
        triggeredRules.push(outcome);
        collectedActions.push(...rule.actions);
      }
    }

    const decision = this.resolveDecision(collectedActions);

    return {
      decision,
      triggeredRules,
      allRuleResults,
      actions: collectedActions,
    };
  }

  // ─── Decision resolution ──────────────────────────────────────────

  /**
   * Resolve the final decision from collected actions.
   *
   * Hierarchy: BLOCK > REVIEW > ALLOW
   *   - If any action is "block_transaction" → BLOCK
   *   - If any action is "create_alert" → REVIEW
   *   - Otherwise → ALLOW
   */
  private static resolveDecision(actions: ActionDefinition[]): Decision {
    if (actions.length === 0) return 'ALLOW';

    const hasBlock = actions.some((a) => a.type === 'block_transaction');
    if (hasBlock) return 'BLOCK';

    const hasAlert = actions.some(
      (a) => a.type === 'create_alert' || a.type === 'webhook' || a.type === 'publish_queue',
    );
    if (hasAlert) return 'REVIEW';

    return 'ALLOW';
  }
}

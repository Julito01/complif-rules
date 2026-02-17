/**
 * Domain Tests: Transaction Evaluation Engine
 *
 * Tests the engine that orchestrates evaluating a transaction against
 * multiple active rule versions and produces an EvaluationResult.
 *
 * This tests:
 * - Multiple rules triggering on the same transaction
 * - Priority-based decision resolution (BLOCK > REVIEW > ALLOW)
 * - Deterministic re-evaluation (same inputs → same outputs)
 * - Action collection from triggered rules
 * - Aggregation facts injection into condition evaluation
 *
 * NO database, NO HTTP — pure functions only.
 * Aggregation values are pre-computed and injected as facts.
 */

import { TransactionEvaluationEngine } from './transaction-evaluation-engine.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types (will be domain entities/VOs)
// ─────────────────────────────────────────────────────────────────────────────

interface ConditionNode {
  all?: ConditionNode[];
  any?: ConditionNode[];
  fact?: string;
  operator?: string;
  value?: unknown;
}

interface ActionDef {
  type: string;
  severity?: string;
  category?: string;
  [key: string]: unknown;
}

interface RuleVersionForEval {
  id: string;
  idRuleTemplate: string;
  versionNumber: number;
  conditions: ConditionNode;
  actions: ActionDef[];
  priority: number;
}

interface TransactionFacts {
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<RuleVersionForEval> & { id: string }): RuleVersionForEval {
  return {
    idRuleTemplate: 'tpl-1',
    versionNumber: 1,
    conditions: {
      all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 10000 }],
    },
    actions: [{ type: 'create_alert', severity: 'HIGH', category: 'AML' }],
    priority: 1,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('TransactionEvaluationEngine', () => {
  // ─── Single rule evaluation ───────────────────────────────────────

  describe('single rule', () => {
    it('should return ALLOW when no rules trigger', () => {
      const rules = [makeRule({ id: 'rule-1' })];
      const facts: TransactionFacts = { transaction: { amount: 5000 } };

      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.decision).toBe('ALLOW');
      expect(result.triggeredRules).toHaveLength(0);
    });

    it('should trigger a rule and collect its actions', () => {
      const rules = [makeRule({ id: 'rule-1' })];
      const facts: TransactionFacts = { transaction: { amount: 15000 } };

      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.decision).not.toBe('ALLOW');
      expect(result.triggeredRules).toHaveLength(1);
      expect(result.triggeredRules[0].ruleVersionId).toBe('rule-1');
      expect(result.triggeredRules[0].satisfied).toBe(true);
    });
  });

  // ─── Multiple rules triggering ───────────────────────────────────

  describe('multiple rules', () => {
    it('should evaluate all rules and collect all triggered', () => {
      const rules = [
        makeRule({
          id: 'rule-amount',
          priority: 2,
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 10000,
              },
            ],
          },
          actions: [{ type: 'create_alert', severity: 'MEDIUM', category: 'AML' }],
        }),
        makeRule({
          id: 'rule-country',
          priority: 1,
          conditions: {
            all: [
              {
                fact: 'transaction.country',
                operator: 'notIn',
                value: ['AR', 'UY'],
              },
            ],
          },
          actions: [{ type: 'create_alert', severity: 'HIGH', category: 'FRAUD' }],
        }),
      ];

      const facts: TransactionFacts = {
        transaction: { amount: 15000, country: 'BR' },
      };

      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.triggeredRules).toHaveLength(2);
    });

    it('should not include rules that did not trigger', () => {
      const rules = [
        makeRule({
          id: 'rule-triggers',
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 10000,
              },
            ],
          },
        }),
        makeRule({
          id: 'rule-does-not-trigger',
          conditions: {
            all: [
              {
                fact: 'transaction.type',
                operator: 'equal',
                value: 'CASH_OUT',
              },
            ],
          },
        }),
      ];

      const facts: TransactionFacts = {
        transaction: { amount: 15000, type: 'CASH_IN' },
      };

      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.triggeredRules).toHaveLength(1);
      expect(result.triggeredRules[0].ruleVersionId).toBe('rule-triggers');
    });
  });

  // ─── Decision resolution ──────────────────────────────────────────

  describe('decision resolution', () => {
    it('should resolve to BLOCK when any triggered action is block_transaction', () => {
      const rules = [
        makeRule({
          id: 'rule-block',
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 50000,
              },
            ],
          },
          actions: [{ type: 'block_transaction' }],
        }),
        makeRule({
          id: 'rule-alert',
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 10000,
              },
            ],
          },
          actions: [{ type: 'create_alert', severity: 'HIGH', category: 'AML' }],
        }),
      ];

      const facts: TransactionFacts = { transaction: { amount: 60000 } };
      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.decision).toBe('BLOCK');
    });

    it('should resolve to REVIEW when alert actions fire but no block', () => {
      const rules = [
        makeRule({
          id: 'rule-alert',
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 10000,
              },
            ],
          },
          actions: [{ type: 'create_alert', severity: 'HIGH', category: 'AML' }],
        }),
      ];

      const facts: TransactionFacts = { transaction: { amount: 15000 } };
      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.decision).toBe('REVIEW');
    });

    it('should resolve to ALLOW when no rules trigger', () => {
      const rules = [makeRule({ id: 'rule-1' })];
      const facts: TransactionFacts = { transaction: { amount: 5000 } };

      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.decision).toBe('ALLOW');
    });

    it('BLOCK takes precedence over REVIEW (priority based on action severity)', () => {
      const rules = [
        makeRule({
          id: 'rule-review',
          priority: 1,
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 10000,
              },
            ],
          },
          actions: [{ type: 'create_alert', severity: 'MEDIUM', category: 'AML' }],
        }),
        makeRule({
          id: 'rule-block',
          priority: 2,
          conditions: {
            all: [
              {
                fact: 'transaction.country',
                operator: 'equal',
                value: 'SANCTIONED',
              },
            ],
          },
          actions: [{ type: 'block_transaction' }],
        }),
      ];

      const facts: TransactionFacts = {
        transaction: { amount: 15000, country: 'SANCTIONED' },
      };
      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.decision).toBe('BLOCK');
    });
  });

  // ─── Aggregation facts ───────────────────────────────────────────

  describe('aggregation facts injection', () => {
    it('should evaluate conditions that use pre-computed aggregation values', () => {
      const rules = [
        makeRule({
          id: 'rule-velocity',
          conditions: {
            all: [
              {
                fact: 'aggregations.tx_count_24h',
                operator: 'greaterThan',
                value: 10,
              },
            ],
          },
          actions: [{ type: 'create_alert', severity: 'HIGH', category: 'FRAUD' }],
        }),
      ];

      const facts: TransactionFacts = {
        transaction: { amount: 100 },
        aggregations: { tx_count_24h: 15 },
      };

      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.triggeredRules).toHaveLength(1);
    });

    it('should evaluate combined aggregation + direct fact conditions', () => {
      const rules = [
        makeRule({
          id: 'rule-combined',
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 5000,
              },
              {
                fact: 'aggregations.sum_amount_7d',
                operator: 'greaterThan',
                value: 50000,
              },
            ],
          },
          actions: [{ type: 'block_transaction' }],
        }),
      ];

      // Both conditions met
      const facts1: TransactionFacts = {
        transaction: { amount: 6000 },
        aggregations: { sum_amount_7d: 60000 },
      };
      expect(TransactionEvaluationEngine.evaluate(rules, facts1).decision).toBe('BLOCK');

      // Only one condition met
      const facts2: TransactionFacts = {
        transaction: { amount: 6000 },
        aggregations: { sum_amount_7d: 40000 },
      };
      expect(TransactionEvaluationEngine.evaluate(rules, facts2).decision).toBe('ALLOW');
    });
  });

  // ─── Deterministic re-evaluation ──────────────────────────────────

  describe('deterministic re-evaluation', () => {
    it('should produce identical results for identical inputs', () => {
      const rules = [
        makeRule({
          id: 'rule-1',
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 10000,
              },
              {
                any: [
                  {
                    fact: 'transaction.country',
                    operator: 'notIn',
                    value: ['AR', 'UY'],
                  },
                  {
                    fact: 'account.risk_score',
                    operator: 'greaterThan',
                    value: 70,
                  },
                ],
              },
            ],
          },
          actions: [{ type: 'create_alert', severity: 'HIGH', category: 'AML' }],
        }),
      ];

      const facts: TransactionFacts = {
        transaction: { amount: 15000, country: 'BR' },
        account: { risk_score: 50 },
      };

      const result1 = TransactionEvaluationEngine.evaluate(rules, facts);
      const result2 = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result1.decision).toBe(result2.decision);
      expect(result1.triggeredRules).toEqual(result2.triggeredRules);
    });

    it('should produce different results when aggregation facts change', () => {
      const rules = [
        makeRule({
          id: 'rule-velocity',
          conditions: {
            all: [
              {
                fact: 'aggregations.tx_count_24h',
                operator: 'greaterThan',
                value: 10,
              },
            ],
          },
          actions: [{ type: 'create_alert', severity: 'HIGH', category: 'FRAUD' }],
        }),
      ];

      // Below threshold
      const facts1: TransactionFacts = {
        transaction: { amount: 100 },
        aggregations: { tx_count_24h: 5 },
      };
      const result1 = TransactionEvaluationEngine.evaluate(rules, facts1);
      expect(result1.decision).toBe('ALLOW');

      // Above threshold
      const facts2: TransactionFacts = {
        transaction: { amount: 100 },
        aggregations: { tx_count_24h: 15 },
      };
      const result2 = TransactionEvaluationEngine.evaluate(rules, facts2);
      expect(result2.decision).toBe('REVIEW');
    });
  });

  // ─── EvaluationResult structure ───────────────────────────────────

  describe('evaluation result structure', () => {
    it('should include all rule evaluation outcomes (pass and fail)', () => {
      const rules = [
        makeRule({
          id: 'rule-pass',
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 10000,
              },
            ],
          },
        }),
        makeRule({
          id: 'rule-fail',
          conditions: {
            all: [
              {
                fact: 'transaction.type',
                operator: 'equal',
                value: 'CASH_OUT',
              },
            ],
          },
        }),
      ];

      const facts: TransactionFacts = {
        transaction: { amount: 15000, type: 'CASH_IN' },
      };

      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      // allRuleResults has every rule, not just triggered ones
      expect(result.allRuleResults).toHaveLength(2);
      expect(result.allRuleResults.find((r) => r.ruleVersionId === 'rule-pass')?.satisfied).toBe(
        true,
      );
      expect(result.allRuleResults.find((r) => r.ruleVersionId === 'rule-fail')?.satisfied).toBe(
        false,
      );
    });

    it('should collect all actions from all triggered rules', () => {
      const rules = [
        makeRule({
          id: 'rule-1',
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 10000,
              },
            ],
          },
          actions: [
            { type: 'create_alert', severity: 'HIGH', category: 'AML' },
            { type: 'webhook', url: 'https://example.com/alert' },
          ],
        }),
        makeRule({
          id: 'rule-2',
          conditions: {
            all: [
              {
                fact: 'transaction.country',
                operator: 'notIn',
                value: ['AR'],
              },
            ],
          },
          actions: [{ type: 'block_transaction' }],
        }),
      ];

      const facts: TransactionFacts = {
        transaction: { amount: 15000, country: 'BR' },
      };

      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      // 3 total actions from 2 triggered rules
      expect(result.actions).toHaveLength(3);
      expect(result.actions.map((a) => a.type)).toEqual(
        expect.arrayContaining(['create_alert', 'webhook', 'block_transaction']),
      );
    });
  });

  // ─── Additional edge cases ──────────────────────────────────────────

  describe('empty and edge inputs', () => {
    it('should return ALLOW with empty rules array', () => {
      const facts: TransactionFacts = { transaction: { amount: 100 } };
      const result = TransactionEvaluationEngine.evaluate([], facts);

      expect(result.decision).toBe('ALLOW');
      expect(result.triggeredRules).toHaveLength(0);
      expect(result.allRuleResults).toHaveLength(0);
      expect(result.actions).toHaveLength(0);
    });

    it('should handle a triggered rule with empty actions array', () => {
      const rules = [
        makeRule({
          id: 'rule-no-actions',
          conditions: {
            all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 0 }],
          },
          actions: [],
        }),
      ];

      const facts: TransactionFacts = { transaction: { amount: 100 } };
      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.triggeredRules).toHaveLength(1);
      expect(result.actions).toHaveLength(0);
      expect(result.decision).toBe('ALLOW'); // no actions → ALLOW
    });

    it('should return ALLOW for unknown action types', () => {
      const rules = [
        makeRule({
          id: 'rule-unknown-action',
          conditions: {
            all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 0 }],
          },
          actions: [{ type: 'log_only' }],
        }),
      ];

      const facts: TransactionFacts = { transaction: { amount: 100 } };
      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.triggeredRules).toHaveLength(1);
      expect(result.decision).toBe('ALLOW');
    });

    it('should return REVIEW for webhook action type', () => {
      const rules = [
        makeRule({
          id: 'rule-webhook',
          conditions: {
            all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 0 }],
          },
          actions: [{ type: 'webhook', url: 'https://example.com' }],
        }),
      ];

      const facts: TransactionFacts = { transaction: { amount: 100 } };
      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.decision).toBe('REVIEW');
    });

    it('should return REVIEW for publish_queue action type', () => {
      const rules = [
        makeRule({
          id: 'rule-queue',
          conditions: {
            all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 0 }],
          },
          actions: [{ type: 'publish_queue', queue: 'alerts' }],
        }),
      ];

      const facts: TransactionFacts = { transaction: { amount: 100 } };
      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.decision).toBe('REVIEW');
    });

    it('should handle BLOCK + REVIEW actions within a single rule', () => {
      const rules = [
        makeRule({
          id: 'rule-mixed',
          conditions: {
            all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 0 }],
          },
          actions: [
            { type: 'create_alert', severity: 'HIGH', category: 'AML' },
            { type: 'block_transaction' },
          ],
        }),
      ];

      const facts: TransactionFacts = { transaction: { amount: 100 } };
      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.decision).toBe('BLOCK');
      expect(result.actions).toHaveLength(2);
    });

    it('should evaluate all rules when ALL trigger', () => {
      const rules = [
        makeRule({
          id: 'rule-1',
          conditions: {
            all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 0 }],
          },
          actions: [{ type: 'create_alert', severity: 'LOW' }],
        }),
        makeRule({
          id: 'rule-2',
          conditions: {
            all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 0 }],
          },
          actions: [{ type: 'create_alert', severity: 'HIGH' }],
        }),
        makeRule({
          id: 'rule-3',
          conditions: {
            all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 0 }],
          },
          actions: [{ type: 'create_alert', severity: 'MEDIUM' }],
        }),
      ];

      const facts: TransactionFacts = { transaction: { amount: 100 } };
      const result = TransactionEvaluationEngine.evaluate(rules, facts);

      expect(result.triggeredRules).toHaveLength(3);
      expect(result.allRuleResults).toHaveLength(3);
      expect(result.actions).toHaveLength(3);
      expect(result.decision).toBe('REVIEW');
    });
  });
});

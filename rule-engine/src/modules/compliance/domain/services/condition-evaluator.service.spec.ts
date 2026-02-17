/**
 * Domain Tests: Condition Evaluator
 *
 * Tests the pure condition tree evaluation logic.
 * This evaluator takes a condition tree (all/any + leaf predicates)
 * and a set of facts, and returns whether the conditions are satisfied.
 *
 * NO database, NO HTTP, NO NestJS — pure functions only.
 */

import { ConditionEvaluator } from './condition-evaluator.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types used in tests (will be implemented as value objects)
// ─────────────────────────────────────────────────────────────────────────────

interface ConditionNode {
  all?: ConditionNode[];
  any?: ConditionNode[];
  not?: ConditionNode;
  fact?: string;
  operator?: string;
  value?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ConditionEvaluator', () => {
  // ─── Leaf predicates ────────────────────────────────────────────────

  describe('leaf predicates', () => {
    it('should evaluate greaterThan correctly', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'greaterThan',
        value: 10000,
      };
      const facts = { transaction: { amount: 15000 } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('should fail greaterThan when value is equal', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'greaterThan',
        value: 10000,
      };
      const facts = { transaction: { amount: 10000 } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });

    it('should evaluate lessThan correctly', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'lessThan',
        value: 500,
      };
      const facts = { transaction: { amount: 200 } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('should evaluate equal correctly', () => {
      const condition: ConditionNode = {
        fact: 'transaction.type',
        operator: 'equal',
        value: 'CASH_OUT',
      };
      const facts = { transaction: { type: 'CASH_OUT' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('should evaluate notEqual correctly', () => {
      const condition: ConditionNode = {
        fact: 'transaction.type',
        operator: 'notEqual',
        value: 'CASH_IN',
      };
      const facts = { transaction: { type: 'CASH_OUT' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('should evaluate in operator', () => {
      const condition: ConditionNode = {
        fact: 'transaction.country',
        operator: 'in',
        value: ['AR', 'UY', 'CL'],
      };
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { country: 'AR' },
        }),
      ).toBe(true);
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { country: 'BR' },
        }),
      ).toBe(false);
    });

    it('should evaluate notIn operator', () => {
      const condition: ConditionNode = {
        fact: 'transaction.country',
        operator: 'notIn',
        value: ['AR', 'UY', 'CL'],
      };
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { country: 'BR' },
        }),
      ).toBe(true);
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { country: 'AR' },
        }),
      ).toBe(false);
    });

    it('should evaluate greaterThanOrEqual', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'greaterThanOrEqual',
        value: 10000,
      };
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 10000 },
        }),
      ).toBe(true);
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 9999 },
        }),
      ).toBe(false);
    });

    it('should evaluate lessThanOrEqual', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'lessThanOrEqual',
        value: 500,
      };
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 500 },
        }),
      ).toBe(true);
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 501 },
        }),
      ).toBe(false);
    });

    it('should return false for unknown operator', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'banana',
        value: 100,
      };
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 100 },
        }),
      ).toBe(false);
    });

    it('should return false when fact path does not exist', () => {
      const condition: ConditionNode = {
        fact: 'transaction.nonexistent.deep.path',
        operator: 'greaterThan',
        value: 0,
      };
      expect(ConditionEvaluator.evaluate(condition, { transaction: {} })).toBe(false);
    });
  });

  // ─── Dot-notation fact resolution ──────────────────────────────────

  describe('fact resolution (dot notation)', () => {
    it('should resolve nested facts', () => {
      const condition: ConditionNode = {
        fact: 'account.risk_score',
        operator: 'greaterThan',
        value: 70,
      };
      const facts = { account: { risk_score: 80 } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('should resolve deeply nested facts', () => {
      const condition: ConditionNode = {
        fact: 'transaction.data.geo.country',
        operator: 'equal',
        value: 'BR',
      };
      const facts = {
        transaction: { data: { geo: { country: 'BR' } } },
      };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });
  });

  // ─── ALL (AND) combinator ─────────────────────────────────────────

  describe('ALL (AND) combinator', () => {
    it('should pass when all children pass', () => {
      const condition: ConditionNode = {
        all: [
          { fact: 'transaction.amount', operator: 'greaterThan', value: 10000 },
          { fact: 'transaction.type', operator: 'equal', value: 'CASH_OUT' },
        ],
      };
      const facts = { transaction: { amount: 15000, type: 'CASH_OUT' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('should fail when any child fails', () => {
      const condition: ConditionNode = {
        all: [
          { fact: 'transaction.amount', operator: 'greaterThan', value: 10000 },
          { fact: 'transaction.type', operator: 'equal', value: 'CASH_OUT' },
        ],
      };
      const facts = { transaction: { amount: 15000, type: 'CASH_IN' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });

    it('should pass with empty children (vacuous truth)', () => {
      const condition: ConditionNode = { all: [] };
      expect(ConditionEvaluator.evaluate(condition, {})).toBe(true);
    });
  });

  // ─── ANY (OR) combinator ──────────────────────────────────────────

  describe('ANY (OR) combinator', () => {
    it('should pass when at least one child passes', () => {
      const condition: ConditionNode = {
        any: [
          {
            fact: 'transaction.country',
            operator: 'notIn',
            value: ['AR', 'UY', 'CL'],
          },
          { fact: 'account.risk_score', operator: 'greaterThan', value: 70 },
        ],
      };
      const facts = {
        transaction: { country: 'AR' },
        account: { risk_score: 80 },
      };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('should fail when no child passes', () => {
      const condition: ConditionNode = {
        any: [
          {
            fact: 'transaction.country',
            operator: 'notIn',
            value: ['AR', 'UY'],
          },
          { fact: 'account.risk_score', operator: 'greaterThan', value: 70 },
        ],
      };
      const facts = {
        transaction: { country: 'AR' },
        account: { risk_score: 50 },
      };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });

    it('should fail with empty children', () => {
      const condition: ConditionNode = { any: [] };
      expect(ConditionEvaluator.evaluate(condition, {})).toBe(false);
    });
  });

  // ─── Nested combinators ───────────────────────────────────────────

  describe('nested combinators', () => {
    it('should evaluate the PDF example: amount > 10000 AND (country notIn [AR,UY,CL] OR risk > 70)', () => {
      const condition: ConditionNode = {
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
                value: ['AR', 'UY', 'CL'],
              },
              {
                fact: 'account.risk_score',
                operator: 'greaterThan',
                value: 70,
              },
            ],
          },
        ],
      };

      // High amount + foreign country → PASS
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 15000, country: 'BR' },
          account: { risk_score: 50 },
        }),
      ).toBe(true);

      // High amount + high risk (domestic) → PASS
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 15000, country: 'AR' },
          account: { risk_score: 80 },
        }),
      ).toBe(true);

      // High amount + domestic + low risk → FAIL
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 15000, country: 'AR' },
          account: { risk_score: 50 },
        }),
      ).toBe(false);

      // Low amount → FAIL regardless
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 5000, country: 'BR' },
          account: { risk_score: 80 },
        }),
      ).toBe(false);
    });

    it('should evaluate 3-level deep nesting', () => {
      const condition: ConditionNode = {
        all: [
          { fact: 'transaction.amount', operator: 'greaterThan', value: 1000 },
          {
            any: [
              {
                all: [
                  {
                    fact: 'transaction.type',
                    operator: 'equal',
                    value: 'CASH_OUT',
                  },
                  {
                    fact: 'transaction.country',
                    operator: 'notIn',
                    value: ['AR'],
                  },
                ],
              },
              {
                fact: 'account.risk_score',
                operator: 'greaterThan',
                value: 90,
              },
            ],
          },
        ],
      };

      // amount > 1000 AND (CASH_OUT + foreign) → PASS
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 2000, type: 'CASH_OUT', country: 'BR' },
          account: { risk_score: 10 },
        }),
      ).toBe(true);

      // amount > 1000 AND high risk → PASS
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 2000, type: 'CASH_IN', country: 'AR' },
          account: { risk_score: 95 },
        }),
      ).toBe(true);

      // amount > 1000 AND CASH_OUT + domestic + low risk → FAIL
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 2000, type: 'CASH_OUT', country: 'AR' },
          account: { risk_score: 50 },
        }),
      ).toBe(false);
    });
  });

  // ─── Evaluation result with trace ────────────────────────────────

  describe('evaluateWithTrace', () => {
    it('should return trace of all evaluated conditions', () => {
      const condition: ConditionNode = {
        all: [
          { fact: 'transaction.amount', operator: 'greaterThan', value: 10000 },
          { fact: 'transaction.type', operator: 'equal', value: 'CASH_OUT' },
        ],
      };
      const facts = { transaction: { amount: 15000, type: 'CASH_OUT' } };

      const result = ConditionEvaluator.evaluateWithTrace(condition, facts);

      expect(result.satisfied).toBe(true);
      expect(result.trace).toBeDefined();
      expect(result.trace.children).toHaveLength(2);
      expect(result.trace.children![0].satisfied).toBe(true);
      expect(result.trace.children![1].satisfied).toBe(true);
    });

    it('should trace failures clearly', () => {
      const condition: ConditionNode = {
        all: [
          { fact: 'transaction.amount', operator: 'greaterThan', value: 10000 },
          { fact: 'transaction.type', operator: 'equal', value: 'CASH_OUT' },
        ],
      };
      const facts = { transaction: { amount: 15000, type: 'CASH_IN' } };

      const result = ConditionEvaluator.evaluateWithTrace(condition, facts);

      expect(result.satisfied).toBe(false);
      expect(result.trace.children![0].satisfied).toBe(true); // amount passes
      expect(result.trace.children![1].satisfied).toBe(false); // type fails
      expect(result.trace.children![1].actual).toBe('CASH_IN');
      expect(result.trace.children![1].expected).toBe('CASH_OUT');
    });
  });

  // ─── Missing operator coverage ─────────────────────────────────────

  describe('contains / notContains operators', () => {
    it('contains should match substring', () => {
      const condition: ConditionNode = {
        fact: 'transaction.description',
        operator: 'contains',
        value: 'wire',
      };
      const facts = { transaction: { description: 'international wire transfer' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('contains should return false when substring not found', () => {
      const condition: ConditionNode = {
        fact: 'transaction.description',
        operator: 'contains',
        value: 'cash',
      };
      const facts = { transaction: { description: 'international wire transfer' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });

    it('contains should return false when actual is not a string', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'contains',
        value: '100',
      };
      const facts = { transaction: { amount: 100 } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });

    it('notContains should return true when substring not found', () => {
      const condition: ConditionNode = {
        fact: 'transaction.description',
        operator: 'notContains',
        value: 'cash',
      };
      const facts = { transaction: { description: 'wire transfer' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('notContains should return false when substring found', () => {
      const condition: ConditionNode = {
        fact: 'transaction.description',
        operator: 'notContains',
        value: 'wire',
      };
      const facts = { transaction: { description: 'wire transfer' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });
  });

  describe('exists / notExists operators', () => {
    it('exists should return true for present value', () => {
      const condition: ConditionNode = {
        fact: 'transaction.country',
        operator: 'exists',
        value: null,
      };
      const facts = { transaction: { country: 'BR' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('exists should return false for null value', () => {
      const condition: ConditionNode = {
        fact: 'transaction.country',
        operator: 'exists',
        value: null,
      };
      const facts = { transaction: { country: null } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });

    it('exists should return false for undefined (missing) field', () => {
      const condition: ConditionNode = {
        fact: 'transaction.country',
        operator: 'exists',
        value: null,
      };
      const facts = { transaction: { amount: 100 } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });

    it('exists should return true for falsy but defined values (0, empty string)', () => {
      const zeroCondition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'exists',
        value: null,
      };
      expect(ConditionEvaluator.evaluate(zeroCondition, { transaction: { amount: 0 } })).toBe(true);

      const emptyCondition: ConditionNode = {
        fact: 'transaction.country',
        operator: 'exists',
        value: null,
      };
      expect(ConditionEvaluator.evaluate(emptyCondition, { transaction: { country: '' } })).toBe(
        true,
      );
    });

    it('notExists should return true for null', () => {
      const condition: ConditionNode = {
        fact: 'transaction.country',
        operator: 'notExists',
        value: null,
      };
      const facts = { transaction: { country: null } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('notExists should return true for missing field', () => {
      const condition: ConditionNode = {
        fact: 'transaction.country',
        operator: 'notExists',
        value: null,
      };
      const facts = { transaction: { amount: 100 } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('notExists should return false for present value', () => {
      const condition: ConditionNode = {
        fact: 'transaction.country',
        operator: 'notExists',
        value: null,
      };
      const facts = { transaction: { country: 'US' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });
  });

  describe('type safety edge cases', () => {
    it('numeric operators return false when actual is a string', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'greaterThan',
        value: 100,
      };
      const facts = { transaction: { amount: '200' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });

    it('in operator returns false when expected is not an array', () => {
      const condition: ConditionNode = {
        fact: 'transaction.type',
        operator: 'in',
        value: 'CASH_OUT',
      };
      const facts = { transaction: { type: 'CASH_OUT' } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });

    it('equal operator handles null actual vs null expected', () => {
      const condition: ConditionNode = {
        fact: 'transaction.country',
        operator: 'equal',
        value: null,
      };
      const facts = { transaction: { country: null } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('equal operator handles undefined actual (missing field)', () => {
      const condition: ConditionNode = {
        fact: 'transaction.missing',
        operator: 'equal',
        value: null,
      };
      const facts = { transaction: { amount: 100 } };
      // undefined !== null
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });

    it('leaf without fact or operator returns false', () => {
      const condition: ConditionNode = { value: 100 };
      expect(ConditionEvaluator.evaluate(condition, {})).toBe(false);
    });
  });

  // ─── NOT combinator ─────────────────────────────────────────────────

  describe('NOT combinator', () => {
    it('should negate a leaf predicate (true → false)', () => {
      const condition: ConditionNode = {
        not: { fact: 'transaction.amount', operator: 'greaterThan', value: 100 },
      };
      const facts = { transaction: { amount: 200 } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(false);
    });

    it('should negate a leaf predicate (false → true)', () => {
      const condition: ConditionNode = {
        not: { fact: 'transaction.amount', operator: 'greaterThan', value: 100 },
      };
      const facts = { transaction: { amount: 50 } };
      expect(ConditionEvaluator.evaluate(condition, facts)).toBe(true);
    });

    it('should negate an ALL subtree', () => {
      const condition: ConditionNode = {
        not: {
          all: [
            { fact: 'transaction.amount', operator: 'greaterThan', value: 100 },
            { fact: 'transaction.type', operator: 'equal', value: 'CASH_OUT' },
          ],
        },
      };
      // Both true → ALL true → NOT false
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 200, type: 'CASH_OUT' },
        }),
      ).toBe(false);
      // One false → ALL false → NOT true
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 200, type: 'CASH_IN' },
        }),
      ).toBe(true);
    });

    it('should negate an ANY subtree', () => {
      const condition: ConditionNode = {
        not: {
          any: [
            { fact: 'transaction.country', operator: 'equal', value: 'BR' },
            { fact: 'transaction.country', operator: 'equal', value: 'VE' },
          ],
        },
      };
      // Country matches → ANY true → NOT false
      expect(ConditionEvaluator.evaluate(condition, { transaction: { country: 'BR' } })).toBe(
        false,
      );
      // No match → ANY false → NOT true
      expect(ConditionEvaluator.evaluate(condition, { transaction: { country: 'AR' } })).toBe(true);
    });

    it('should work inside ALL alongside other conditions', () => {
      const condition: ConditionNode = {
        all: [
          { fact: 'transaction.amount', operator: 'greaterThan', value: 1000 },
          {
            not: { fact: 'transaction.country', operator: 'in', value: ['AR', 'UY'] },
          },
        ],
      };
      // High amount + non-listed country → true
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 5000, country: 'BR' },
        }),
      ).toBe(true);
      // High amount + listed country → false (NOT negates)
      expect(
        ConditionEvaluator.evaluate(condition, {
          transaction: { amount: 5000, country: 'AR' },
        }),
      ).toBe(false);
    });

    it('should produce correct trace for NOT', () => {
      const condition: ConditionNode = {
        not: { fact: 'transaction.amount', operator: 'greaterThan', value: 100 },
      };
      const result = ConditionEvaluator.evaluateWithTrace(condition, {
        transaction: { amount: 50 },
      });
      expect(result.satisfied).toBe(true);
      expect(result.trace.combinator).toBe('NOT');
      expect(result.trace.children).toHaveLength(1);
      expect(result.trace.children![0].satisfied).toBe(false);
    });
  });

  // ─── between operator ───────────────────────────────────────────────

  describe('between operator', () => {
    it('should return true when value is within range (inclusive)', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'between',
        value: [1000, 5000],
      };
      expect(ConditionEvaluator.evaluate(condition, { transaction: { amount: 3000 } })).toBe(true);
    });

    it('should return true at lower boundary', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'between',
        value: [1000, 5000],
      };
      expect(ConditionEvaluator.evaluate(condition, { transaction: { amount: 1000 } })).toBe(true);
    });

    it('should return true at upper boundary', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'between',
        value: [1000, 5000],
      };
      expect(ConditionEvaluator.evaluate(condition, { transaction: { amount: 5000 } })).toBe(true);
    });

    it('should return false when below range', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'between',
        value: [1000, 5000],
      };
      expect(ConditionEvaluator.evaluate(condition, { transaction: { amount: 999 } })).toBe(false);
    });

    it('should return false when above range', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'between',
        value: [1000, 5000],
      };
      expect(ConditionEvaluator.evaluate(condition, { transaction: { amount: 5001 } })).toBe(false);
    });

    it('should return false when value is not a number', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'between',
        value: [1000, 5000],
      };
      expect(ConditionEvaluator.evaluate(condition, { transaction: { amount: 'abc' } })).toBe(
        false,
      );
    });

    it('should return false when expected is not a 2-element array', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'between',
        value: [1000],
      };
      expect(ConditionEvaluator.evaluate(condition, { transaction: { amount: 1500 } })).toBe(false);
    });

    it('should return false when range values are not numbers', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'between',
        value: ['a', 'z'],
      };
      expect(ConditionEvaluator.evaluate(condition, { transaction: { amount: 100 } })).toBe(false);
    });
  });

  // ─── regex operator ─────────────────────────────────────────────────

  describe('regex operator', () => {
    it('should match a valid pattern', () => {
      const condition: ConditionNode = {
        fact: 'transaction.externalCode',
        operator: 'regex',
        value: '^TXN-\\d{4}$',
      };
      expect(
        ConditionEvaluator.evaluate(condition, { transaction: { externalCode: 'TXN-1234' } }),
      ).toBe(true);
    });

    it('should not match when pattern does not match', () => {
      const condition: ConditionNode = {
        fact: 'transaction.externalCode',
        operator: 'regex',
        value: '^TXN-\\d{4}$',
      };
      expect(
        ConditionEvaluator.evaluate(condition, { transaction: { externalCode: 'WIRE-1234' } }),
      ).toBe(false);
    });

    it('should return false when fact is not a string', () => {
      const condition: ConditionNode = {
        fact: 'transaction.amount',
        operator: 'regex',
        value: '\\d+',
      };
      expect(ConditionEvaluator.evaluate(condition, { transaction: { amount: 123 } })).toBe(false);
    });

    it('should return false for invalid regex pattern', () => {
      const condition: ConditionNode = {
        fact: 'transaction.externalCode',
        operator: 'regex',
        value: '[invalid',
      };
      expect(
        ConditionEvaluator.evaluate(condition, { transaction: { externalCode: 'test' } }),
      ).toBe(false);
    });

    it('should match partial strings (not anchored by default)', () => {
      const condition: ConditionNode = {
        fact: 'transaction.origin',
        operator: 'regex',
        value: 'API',
      };
      expect(
        ConditionEvaluator.evaluate(condition, { transaction: { origin: 'BATCH_API_V2' } }),
      ).toBe(true);
    });
  });
});

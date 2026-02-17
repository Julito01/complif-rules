/**
 * Condition Evaluator - Domain Service
 *
 * Pure, stateless service that evaluates a condition tree against a set of facts.
 * No database, no side effects, no dependencies — just logic.
 *
 * The condition tree uses:
 *   - `all` (AND): all children must be satisfied
 *   - `any` (OR): at least one child must be satisfied
 *   - `not` (NOT): negates the child subtree
 *   - Leaf: { fact, operator, value }
 *
 * Facts are accessed via dot-notation paths (e.g., "transaction.amount").
 */

import {
  ConditionNode,
  ConditionTrace,
  ConditionEvaluationResult,
} from '../value-objects/condition-node.vo';

// ─────────────────────────────────────────────────────────────────────────────
// Operator implementations (pure functions)
// ─────────────────────────────────────────────────────────────────────────────

type OperatorFn = (actual: unknown, expected: unknown) => boolean;

const OPERATORS: Record<string, OperatorFn> = {
  equal: (a, e) => a === e,
  notEqual: (a, e) => a !== e,
  greaterThan: (a, e) => typeof a === 'number' && typeof e === 'number' && a > e,
  greaterThanOrEqual: (a, e) => typeof a === 'number' && typeof e === 'number' && a >= e,
  lessThan: (a, e) => typeof a === 'number' && typeof e === 'number' && a < e,
  lessThanOrEqual: (a, e) => typeof a === 'number' && typeof e === 'number' && a <= e,
  in: (a, e) => Array.isArray(e) && e.includes(a),
  notIn: (a, e) => Array.isArray(e) && !e.includes(a),
  contains: (a, e) => typeof a === 'string' && typeof e === 'string' && a.includes(e),
  notContains: (a, e) => typeof a === 'string' && typeof e === 'string' && !a.includes(e),
  exists: (a) => a !== null && a !== undefined,
  notExists: (a) => a === null || a === undefined,
  between: (a, e) => {
    if (typeof a !== 'number') return false;
    if (!Array.isArray(e) || e.length !== 2) return false;
    const [min, max] = e;
    if (typeof min !== 'number' || typeof max !== 'number') return false;
    return a >= min && a <= max;
  },
  regex: (a, e) => {
    if (typeof a !== 'string' || typeof e !== 'string') return false;
    try {
      return new RegExp(e).test(a);
    } catch {
      return false;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fact resolution (dot-notation traversal)
// ─────────────────────────────────────────────────────────────────────────────

function resolveFact(facts: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = facts;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluator (static, pure)
// ─────────────────────────────────────────────────────────────────────────────

export class ConditionEvaluator {
  /**
   * Evaluate a condition tree against facts.
   * Returns true if the conditions are satisfied, false otherwise.
   */
  static evaluate(condition: ConditionNode, facts: Record<string, unknown>): boolean {
    return this.evaluateNode(condition, facts);
  }

  /**
   * Evaluate with full trace for auditability.
   */
  static evaluateWithTrace(
    condition: ConditionNode,
    facts: Record<string, unknown>,
  ): ConditionEvaluationResult {
    const trace = this.evaluateNodeWithTrace(condition, facts);
    return {
      satisfied: trace.satisfied,
      trace,
    };
  }

  // ─── Internal ──────────────────────────────────────────────────────

  private static evaluateNode(node: ConditionNode, facts: Record<string, unknown>): boolean {
    // ALL (AND) combinator
    if (node.all !== undefined) {
      return node.all.every((child) => this.evaluateNode(child, facts));
    }

    // ANY (OR) combinator
    if (node.any !== undefined) {
      return node.any.some((child) => this.evaluateNode(child, facts));
    }

    // NOT combinator
    if (node.not !== undefined) {
      return !this.evaluateNode(node.not, facts);
    }

    // Leaf predicate
    return this.evaluateLeaf(node, facts);
  }

  private static evaluateLeaf(node: ConditionNode, facts: Record<string, unknown>): boolean {
    if (!node.fact || !node.operator) return false;

    const actual = resolveFact(facts, node.fact);
    const operatorFn = OPERATORS[node.operator];

    if (!operatorFn) return false;

    return operatorFn(actual, node.value);
  }

  private static evaluateNodeWithTrace(
    node: ConditionNode,
    facts: Record<string, unknown>,
  ): ConditionTrace {
    // ALL (AND) combinator
    if (node.all !== undefined) {
      const children = node.all.map((child) => this.evaluateNodeWithTrace(child, facts));
      return {
        satisfied: children.every((c) => c.satisfied),
        combinator: 'ALL',
        children,
      };
    }

    // ANY (OR) combinator
    if (node.any !== undefined) {
      const children = node.any.map((child) => this.evaluateNodeWithTrace(child, facts));
      return {
        satisfied: children.some((c) => c.satisfied),
        combinator: 'ANY',
        children,
      };
    }

    // NOT combinator
    if (node.not !== undefined) {
      const child = this.evaluateNodeWithTrace(node.not, facts);
      return {
        satisfied: !child.satisfied,
        combinator: 'NOT',
        children: [child],
      };
    }

    // Leaf predicate
    const actual = node.fact ? resolveFact(facts, node.fact) : undefined;
    const operatorFn = node.operator ? OPERATORS[node.operator] : undefined;
    const satisfied = operatorFn ? operatorFn(actual, node.value) : false;

    return {
      satisfied,
      fact: node.fact,
      operator: node.operator,
      expected: node.value,
      actual,
    };
  }
}

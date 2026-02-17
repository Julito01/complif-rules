/**
 * Condition Node - Value Object
 *
 * Represents a node in the condition tree used by compliance rules.
 * Can be a leaf predicate (fact + operator + value) or a combinator (all/any).
 *
 * This is a recursive structure:
 *   - Leaf: { fact, operator, value }
 *   - AND:  { all: [ConditionNode, ...] }
 *   - OR:   { any: [ConditionNode, ...] }
 *
 * Immutable value object — no identity, no mutation.
 */
export interface ConditionNode {
  /** AND combinator — all children must be satisfied */
  all?: ConditionNode[];
  /** OR combinator — at least one child must be satisfied */
  any?: ConditionNode[];
  /** NOT combinator — negates the child subtree */
  not?: ConditionNode;
  /** Dot-notation path to a fact (e.g., "transaction.amount") */
  fact?: string;
  /** Comparison operator (e.g., "greaterThan", "in", "notIn", "between", "regex") */
  operator?: string;
  /** Expected value for comparison */
  value?: unknown;
}

/**
 * Condition evaluation trace node.
 * Provides full auditability of how each condition was evaluated.
 */
export interface ConditionTrace {
  /** Whether this node was satisfied */
  satisfied: boolean;
  /** Combinator type if this is a branch node */
  combinator?: 'ALL' | 'ANY' | 'NOT';
  /** Fact path for leaf nodes */
  fact?: string;
  /** Operator for leaf nodes */
  operator?: string;
  /** Expected value for leaf nodes */
  expected?: unknown;
  /** Actual resolved value for leaf nodes */
  actual?: unknown;
  /** Child traces for combinator nodes */
  children?: ConditionTrace[];
}

/**
 * Result of evaluating a condition tree with full trace.
 */
export interface ConditionEvaluationResult {
  satisfied: boolean;
  trace: ConditionTrace;
}

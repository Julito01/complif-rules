/**
 * Rule Evaluation & Aggregation Explanation Tools
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STRICT CONSTRAINTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * These tools are EXPLANATION-ONLY. They must:
 * - Be deterministic (same input → same output)
 * - Perform NO writes, NO side effects
 * - NOT reuse production evaluation code
 * - Return human-readable explanations
 *
 * They exist to help Claude understand:
 * - How a rule would evaluate a transaction
 * - How aggregations are computed over sliding windows
 * - Why a rule passes or fails
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AVAILABLE TOOLS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. explain_rule_evaluation  - Explain how a rule evaluates a transaction
 * 2. explain_aggregation      - Explain how an aggregation + window works
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types (local to explanation, NOT shared with production code)
// ─────────────────────────────────────────────────────────────────────────────

interface RuleCondition {
  fact?: string;
  operator?: string;
  value?: unknown;
  all?: RuleCondition[];
  any?: RuleCondition[];
}

interface RuleDefinitionV1 {
  id_rule?: string;
  name?: string;
  enabled?: boolean;
  priority?: number;
  conditions?: RuleCondition;
  actions?: Array<{ type: string; [key: string]: unknown }>;
}

interface TransactionFacts {
  [key: string]: unknown;
}

interface ConditionExplanation {
  fact?: string;
  operator?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  satisfied: boolean;
  explanation: string;
  children?: ConditionExplanation[];
  combinator?: 'ALL' | 'ANY';
}

interface RuleEvaluationExplanation {
  ruleName: string;
  ruleId: string;
  enabled: boolean;
  priority: number;
  overallSatisfied: boolean;
  conditionTree: ConditionExplanation;
  triggeredActions: Array<{ type: string; wouldFire: boolean; reason: string }>;
  aggregationsNeeded: AggregationReference[];
  note: string;
}

interface AggregationReference {
  fact: string;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Operator Evaluation (pure, no side effects)
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_OPERATORS: Record<string, string> = {
  equal: 'equals',
  notEqual: 'does not equal',
  greaterThan: 'is greater than',
  greaterThanOrEqual: 'is greater than or equal to',
  lessThan: 'is less than',
  lessThanOrEqual: 'is less than or equal to',
  in: 'is in list',
  notIn: 'is not in list',
  contains: 'contains',
  notContains: 'does not contain',
  exists: 'exists (is not null/undefined)',
  notExists: 'does not exist (is null/undefined)',
};

function evaluateOperator(operator: string, actual: unknown, expected: unknown): boolean {
  switch (operator) {
    case 'equal':
      return actual === expected;
    case 'notEqual':
      return actual !== expected;
    case 'greaterThan':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'greaterThanOrEqual':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lessThan':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lessThanOrEqual':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'notIn':
      return Array.isArray(expected) && !expected.includes(actual);
    case 'contains':
      return (
        typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected)
      );
    case 'notContains':
      return (
        typeof actual === 'string' && typeof expected === 'string' && !actual.includes(expected)
      );
    case 'exists':
      return actual !== null && actual !== undefined;
    case 'notExists':
      return actual === null || actual === undefined;
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fact Resolution (dot-notation traversal)
// ─────────────────────────────────────────────────────────────────────────────

function resolveFact(facts: TransactionFacts, path: string): unknown {
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
// Condition Tree Explanation (recursive, pure)
// ─────────────────────────────────────────────────────────────────────────────

function explainCondition(
  condition: RuleCondition,
  facts: TransactionFacts,
  aggregationRefs: AggregationReference[],
): ConditionExplanation {
  // ALL combinator
  if (condition.all) {
    const children = condition.all.map((c) => explainCondition(c, facts, aggregationRefs));
    const satisfied = children.every((c) => c.satisfied);
    const metCount = children.filter((c) => c.satisfied).length;
    return {
      combinator: 'ALL',
      satisfied,
      explanation: `ALL (AND): ${metCount}/${children.length} conditions met → ${satisfied ? 'PASS' : 'FAIL'}`,
      children,
    };
  }

  // ANY combinator
  if (condition.any) {
    const children = condition.any.map((c) => explainCondition(c, facts, aggregationRefs));
    const satisfied = children.some((c) => c.satisfied);
    const metCount = children.filter((c) => c.satisfied).length;
    return {
      combinator: 'ANY',
      satisfied,
      explanation: `ANY (OR): ${metCount}/${children.length} conditions met → ${satisfied ? 'PASS' : 'FAIL'}`,
      children,
    };
  }

  // Leaf condition
  const fact = condition.fact || '(unknown)';
  const operator = condition.operator || '(unknown)';
  const expected = condition.value;
  const actual = resolveFact(facts, fact);
  const operatorLabel = SUPPORTED_OPERATORS[operator] || operator;

  // Track if this fact might need aggregation (heuristic: contains window-like patterns)
  if (
    fact.includes('.count_') ||
    fact.includes('.sum_') ||
    fact.includes('.avg_') ||
    fact.includes('.max_') ||
    fact.includes('.min_') ||
    fact.includes('_24h') ||
    fact.includes('_7d') ||
    fact.includes('_30d') ||
    fact.includes('window') ||
    fact.includes('velocity') ||
    fact.includes('aggregat')
  ) {
    aggregationRefs.push({
      fact,
      reason: `Fact "${fact}" appears to reference a computed aggregation that would need a sliding window query.`,
    });
  }

  const satisfied = evaluateOperator(operator, actual, expected);

  const actualStr = actual === undefined ? '(not provided)' : JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);

  return {
    fact,
    operator,
    expectedValue: expected,
    actualValue: actual,
    satisfied,
    explanation: `${fact} ${operatorLabel} ${expectedStr} → actual: ${actualStr} → ${satisfied ? 'PASS' : 'FAIL'}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// explain_rule_evaluation Implementation
// ─────────────────────────────────────────────────────────────────────────────

function explainRuleEvaluation(
  rule: RuleDefinitionV1,
  transaction: TransactionFacts,
): RuleEvaluationExplanation {
  const aggregationRefs: AggregationReference[] = [];

  const conditionTree = rule.conditions
    ? explainCondition(rule.conditions, transaction, aggregationRefs)
    : { satisfied: true, explanation: 'No conditions defined — rule always passes.' };

  const enabled = rule.enabled !== false;
  const overallSatisfied = enabled && conditionTree.satisfied;

  const actions = (rule.actions || []).map((action) => ({
    type: action.type,
    wouldFire: overallSatisfied,
    reason: overallSatisfied
      ? `Action "${action.type}" WOULD fire because rule conditions are satisfied.`
      : `Action "${action.type}" would NOT fire because rule conditions are not satisfied.`,
  }));

  return {
    ruleName: rule.name || '(unnamed)',
    ruleId: rule.id_rule || '(no id)',
    enabled,
    priority: rule.priority || 0,
    overallSatisfied,
    conditionTree,
    triggeredActions: actions,
    aggregationsNeeded: aggregationRefs,
    note:
      'This is a pure explanation. No data was read, written, or persisted. ' +
      'Aggregation values must be pre-computed and provided in the transaction facts.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// explain_aggregation Implementation
// ─────────────────────────────────────────────────────────────────────────────

interface AggregationInput {
  aggregationType: string;
  field?: string;
  window: {
    duration: string;
    unit: string;
  };
  filters?: Record<string, unknown>;
  groupBy?: string;
}

interface AggregationExplanation {
  description: string;
  pseudoSql: string;
  conceptualSteps: string[];
  windowAnalysis: {
    duration: string;
    anchoredTo: string;
    startExpression: string;
    endExpression: string;
  };
  indexRecommendations: string[];
  performanceNotes: string[];
  note: string;
}

function explainAggregation(input: AggregationInput): AggregationExplanation {
  const { aggregationType, field, window, filters, groupBy } = input;

  const aggUpper = aggregationType.toUpperCase();
  const validAggregations = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN'];
  if (!validAggregations.includes(aggUpper)) {
    return {
      description: `Unknown aggregation type: ${aggregationType}`,
      pseudoSql: '-- Invalid aggregation type',
      conceptualSteps: [
        `"${aggregationType}" is not a recognized aggregation. Valid: ${validAggregations.join(', ')}`,
      ],
      windowAnalysis: {
        duration: window.duration + ' ' + window.unit,
        anchoredTo: 'N/A',
        startExpression: 'N/A',
        endExpression: 'N/A',
      },
      indexRecommendations: [],
      performanceNotes: [],
      note: 'This is a pure explanation. No queries were executed.',
    };
  }

  // Build description
  const fieldRef = field || '*';
  const windowDesc = `${window.duration} ${window.unit}`;
  const description =
    aggUpper === 'COUNT'
      ? `Count the number of transactions within a ${windowDesc} sliding window.`
      : `Compute ${aggUpper}(${fieldRef}) over transactions within a ${windowDesc} sliding window.`;

  // Build pseudo-SQL
  const aggExpr = aggUpper === 'COUNT' ? 'COUNT(*)' : `${aggUpper}(t.${fieldRef})`;
  const filterClauses = filters
    ? Object.entries(filters)
        .map(([k, v]) => `  AND t.${k} = '${v}'`)
        .join('\n')
    : '';
  const groupByClause = groupBy ? `GROUP BY t.${groupBy}` : '';

  const pseudoSql = [
    `-- Pseudo-SQL (for reasoning, not execution)`,
    `SELECT ${aggExpr} AS result`,
    `FROM transaction t`,
    `WHERE t.account_id = :accountId`,
    `  AND t.organization_id = :organizationId`,
    `  AND t.datetime >= :txDatetime - INTERVAL '${window.duration} ${window.unit}'`,
    `  AND t.datetime < :txDatetime`,
    `  AND t.is_voided = false`,
    `  AND t.is_deleted = false`,
    filterClauses,
    groupByClause,
  ]
    .filter(Boolean)
    .join('\n');

  // Steps
  const conceptualSteps = [
    `1. Take the current transaction's datetime as the anchor point.`,
    `2. Compute the window start: anchor - ${windowDesc}.`,
    `3. Select all transactions for the same account/organization within [start, anchor).`,
    `4. Exclude voided and deleted transactions.`,
    filters ? `5. Apply additional filters: ${JSON.stringify(filters)}.` : null,
    groupBy ? `6. Group results by: ${groupBy}.` : null,
    `${filters ? (groupBy ? '7' : '6') : groupBy ? '6' : '5'}. Compute ${aggUpper}(${fieldRef}) over the resulting set.`,
    `The result is a single scalar value used as a fact in rule evaluation.`,
  ].filter(Boolean) as string[];

  // Index recommendations
  const indexRecommendations = [
    `CREATE INDEX idx_transaction_account_datetime ON transaction (account_id, datetime DESC)`,
    `-- This composite index supports the most common sliding window query pattern.`,
    filters && Object.keys(filters).includes('type')
      ? `CREATE INDEX idx_transaction_account_type_datetime ON transaction (account_id, type, datetime DESC)`
      : null,
    `-- Consider BRIN index on datetime for very large tables:`,
    `-- CREATE INDEX idx_transaction_datetime_brin ON transaction USING BRIN (datetime)`,
  ].filter(Boolean) as string[];

  const performanceNotes = [
    `Sliding windows are recomputed per evaluation — no pre-aggregated state.`,
    `For p99 < 100ms: ensure the composite index exists and keep window durations reasonable.`,
    `Large windows (30d+) over high-volume accounts may need Redis caching for aggregates.`,
    `Consider partitioning the transaction table by datetime for very large datasets.`,
  ];

  return {
    description,
    pseudoSql,
    conceptualSteps,
    windowAnalysis: {
      duration: windowDesc,
      anchoredTo: 'The datetime of the transaction being evaluated',
      startExpression: `transaction.datetime - INTERVAL '${windowDesc}'`,
      endExpression: `transaction.datetime (exclusive)`,
    },
    indexRecommendations,
    performanceNotes,
    note:
      'This is a pure explanation. No queries were executed. ' +
      'The pseudo-SQL is for reasoning and review, not for production execution.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const explanationTools: Tool[] = [
  {
    name: 'explain_rule_evaluation',
    description: `Explains how a compliance rule would evaluate a given transaction.
Returns a human-readable explanation of:
- Which conditions would be checked
- Which predicates pass or fail
- What aggregations would be needed
- What actions would fire

This is a PURE EXPLANATION tool:
- Deterministic (same input → same output)
- No writes, no side effects
- Does NOT reuse production evaluation code
- Does NOT read from the database

Input: a rule definition (JSON) + transaction facts (JSON).
Output: structured explanation of the evaluation tree.`,
    inputSchema: {
      type: 'object',
      properties: {
        rule: {
          type: 'object',
          description:
            'The rule definition JSON (id_rule, name, enabled, priority, conditions, actions)',
        },
        transaction: {
          type: 'object',
          description:
            'Transaction facts as a flat/nested object. Use dot notation keys matching rule conditions (e.g., {"transaction": {"amount": 15000, "country": "BR"}, "account": {"risk_score": 80}})',
        },
      },
      required: ['rule', 'transaction'],
    },
  },
  {
    name: 'explain_aggregation',
    description: `Explains how an aggregation over a sliding window would be computed.
Returns conceptual steps, pseudo-SQL, and index recommendations.

This is a PURE EXPLANATION tool:
- No queries are executed
- No data is read or written
- Output is for reasoning and review only

Use this tool to:
- Understand how SUM/COUNT/AVG/MAX/MIN aggregations work
- Reason about sliding window boundaries
- Get index recommendations for performance
- Debug window-based rule conditions

Input: aggregation type, field, window definition, optional filters.
Output: description, pseudo-SQL, steps, and performance notes.`,
    inputSchema: {
      type: 'object',
      properties: {
        aggregationType: {
          type: 'string',
          description: 'The aggregation function: COUNT, SUM, AVG, MAX, or MIN',
          enum: ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN'],
        },
        field: {
          type: 'string',
          description:
            'The field to aggregate (e.g., "amount", "amount_normalized"). Not needed for COUNT.',
        },
        window: {
          type: 'object',
          description: 'Sliding window definition',
          properties: {
            duration: {
              type: 'string',
              description: 'Window duration (e.g., "24", "7", "30")',
            },
            unit: {
              type: 'string',
              description: 'Window unit (e.g., "hours", "days", "minutes")',
              enum: ['minutes', 'hours', 'days'],
            },
          },
          required: ['duration', 'unit'],
        },
        filters: {
          type: 'object',
          description: 'Optional additional filters (e.g., {"type": "CASH_OUT"})',
        },
        groupBy: {
          type: 'string',
          description: 'Optional GROUP BY field (e.g., "country")',
        },
      },
      required: ['aggregationType', 'window'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function handleExplanationToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    switch (name) {
      case 'explain_rule_evaluation': {
        const rule = args.rule as RuleDefinitionV1;
        const transaction = args.transaction as TransactionFacts;

        if (!rule || typeof rule !== 'object') {
          throw new Error('Parameter "rule" is required and must be an object.');
        }
        if (!transaction || typeof transaction !== 'object') {
          throw new Error('Parameter "transaction" is required and must be an object.');
        }

        const result = explainRuleEvaluation(rule, transaction);
        return JSON.stringify(result, null, 2);
      }

      case 'explain_aggregation': {
        const aggregationType = args.aggregationType as string;
        const field = args.field as string | undefined;
        const window = args.window as { duration: string; unit: string };
        const filters = args.filters as Record<string, unknown> | undefined;
        const groupBy = args.groupBy as string | undefined;

        if (!aggregationType) {
          throw new Error('Parameter "aggregationType" is required.');
        }
        if (!window || !window.duration || !window.unit) {
          throw new Error('Parameter "window" is required with "duration" and "unit".');
        }

        const result = explainAggregation({
          aggregationType,
          field,
          window,
          filters,
          groupBy,
        });
        return JSON.stringify(result, null, 2);
      }

      default:
        return JSON.stringify({ error: `Unknown explanation tool: ${name}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return JSON.stringify({ error: message });
  }
}

/**
 * Rule Definition Types - used to express AND/OR combinatory logic.
 *
 * Example: (1 from A) OR (2 from B) OR (1 from B AND 2 from C)
 * {
 *   "any": [
 *     { "group": "A", "min": 1 },
 *     { "group": "B", "min": 2 },
 *     { "all": [
 *       { "group": "B", "min": 1 },
 *       { "group": "C", "min": 2 }
 *     ]}
 *   ]
 * }
 */

/**
 * A single group condition: requires `min` signers from `group`.
 */
export interface GroupCondition {
  group: string;
  min: number;
}

/**
 * AND condition: all nested conditions must be satisfied.
 */
export interface AllCondition {
  all: RuleDefinition[];
}

/**
 * OR condition: at least one nested condition must be satisfied.
 */
export interface AnyCondition {
  any: RuleDefinition[];
}

/**
 * Union type for all possible rule definitions.
 */
export type RuleDefinition = GroupCondition | AllCondition | AnyCondition;

/**
 * Type guards for rule definition types.
 */
export function isGroupCondition(rule: RuleDefinition): rule is GroupCondition {
  return 'group' in rule && 'min' in rule;
}

export function isAllCondition(rule: RuleDefinition): rule is AllCondition {
  return 'all' in rule;
}

export function isAnyCondition(rule: RuleDefinition): rule is AnyCondition {
  return 'any' in rule;
}

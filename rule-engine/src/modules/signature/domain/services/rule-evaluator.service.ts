import {
  RuleDefinition,
  isGroupCondition,
  isAllCondition,
  isAnyCondition,
} from '../value-objects/rule-definition.vo';

/**
 * Signature count state per group code.
 * Example: { 'A': 2, 'B': 1, 'C': 3 }
 */
export type GroupSignatureCounts = Record<string, number>;

/**
 * Authorization Combinatorics Engine
 *
 * Per signature-combinatorics skill:
 * - Evaluates whether collected signatures satisfy authorization rules
 * - Output is strictly boolean and deterministic
 * - AND/OR combinations MUST be supported
 * - Evaluation MUST short-circuit on first valid rule
 * - Output MUST be side-effect free
 *
 * This is a pure domain service with no dependencies on infrastructure.
 */
export class RuleEvaluator {
  /**
   * Evaluate if the current signature state satisfies the rule definition.
   *
   * @param rule - The rule definition (AND/OR tree)
   * @param counts - Current signature counts per group code
   * @returns true if authorization is satisfied
   */
  static evaluate(rule: RuleDefinition, counts: GroupSignatureCounts): boolean {
    return RuleEvaluator.evaluateNode(rule, counts);
  }

  private static evaluateNode(node: RuleDefinition, counts: GroupSignatureCounts): boolean {
    // Base case: group condition
    if (isGroupCondition(node)) {
      const currentCount = counts[node.group] || 0;
      return currentCount >= node.min;
    }

    // AND: all children must be satisfied
    if (isAllCondition(node)) {
      return node.all.every((child) => RuleEvaluator.evaluateNode(child, counts));
    }

    // OR: at least one child must be satisfied (short-circuit)
    if (isAnyCondition(node)) {
      return node.any.some((child) => RuleEvaluator.evaluateNode(child, counts));
    }

    // Unknown node type
    return false;
  }

  /**
   * Get the minimum signatures required per group to satisfy the rule.
   * Returns all possible valid combinations.
   *
   * @param rule - The rule definition
   * @returns Array of possible combinations, each is a map of group -> min required
   */
  static getPossibleCombinations(rule: RuleDefinition): GroupSignatureCounts[] {
    return RuleEvaluator.collectCombinations(rule);
  }

  private static collectCombinations(node: RuleDefinition): GroupSignatureCounts[] {
    // Base case: single group condition
    if (isGroupCondition(node)) {
      return [{ [node.group]: node.min }];
    }

    // AND: cartesian product of all children
    if (isAllCondition(node)) {
      let results: GroupSignatureCounts[] = [{}];

      for (const child of node.all) {
        const childCombinations = RuleEvaluator.collectCombinations(child);
        const newResults: GroupSignatureCounts[] = [];

        for (const current of results) {
          for (const childCombo of childCombinations) {
            // Merge counts, taking max if same group appears
            const merged = { ...current };
            for (const [group, count] of Object.entries(childCombo)) {
              merged[group] = Math.max(merged[group] || 0, count);
            }
            newResults.push(merged);
          }
        }

        results = newResults;
      }

      return results;
    }

    // OR: union of all children (each child is a valid path)
    if (isAnyCondition(node)) {
      const results: GroupSignatureCounts[] = [];
      for (const child of node.any) {
        results.push(...RuleEvaluator.collectCombinations(child));
      }
      return results;
    }

    return [];
  }

  /**
   * Get remaining signatures needed per group to satisfy the rule.
   * Returns null if already satisfied, or the minimum additional signatures needed.
   *
   * @param rule - The rule definition
   * @param counts - Current signature counts
   * @returns Map of group -> additional signatures needed, or null if satisfied
   */
  static getRemainingRequired(
    rule: RuleDefinition,
    counts: GroupSignatureCounts,
  ): GroupSignatureCounts | null {
    if (RuleEvaluator.evaluate(rule, counts)) {
      return null; // Already satisfied
    }

    const combinations = RuleEvaluator.getPossibleCombinations(rule);
    let bestRemaining: GroupSignatureCounts | null = null;
    let bestTotalRemaining = Infinity;

    for (const combo of combinations) {
      const remaining: GroupSignatureCounts = {};
      let totalRemaining = 0;

      for (const [group, required] of Object.entries(combo)) {
        const current = counts[group] || 0;
        const needed = Math.max(0, required - current);
        if (needed > 0) {
          remaining[group] = needed;
          totalRemaining += needed;
        }
      }

      if (totalRemaining < bestTotalRemaining) {
        bestTotalRemaining = totalRemaining;
        bestRemaining = remaining;
      }
    }

    return bestRemaining;
  }
}

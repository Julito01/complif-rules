import { RuleEvaluator, GroupSignatureCounts } from './rule-evaluator.service';
import { RuleDefinition } from '../value-objects/rule-definition.vo';

describe('RuleEvaluator', () => {
  describe('evaluate', () => {
    it('should satisfy a simple group condition', () => {
      const rule: RuleDefinition = { group: 'A', min: 2 };
      const counts: GroupSignatureCounts = { A: 2 };

      expect(RuleEvaluator.evaluate(rule, counts)).toBe(true);
    });

    it('should not satisfy when group count is below minimum', () => {
      const rule: RuleDefinition = { group: 'A', min: 2 };
      const counts: GroupSignatureCounts = { A: 1 };

      expect(RuleEvaluator.evaluate(rule, counts)).toBe(false);
    });

    it('should handle missing group in counts', () => {
      const rule: RuleDefinition = { group: 'A', min: 1 };
      const counts: GroupSignatureCounts = {};

      expect(RuleEvaluator.evaluate(rule, counts)).toBe(false);
    });

    describe('OR conditions (any)', () => {
      it('should satisfy when any child is satisfied', () => {
        // (1 from A) OR (2 from B)
        const rule: RuleDefinition = {
          any: [
            { group: 'A', min: 1 },
            { group: 'B', min: 2 },
          ],
        };

        expect(RuleEvaluator.evaluate(rule, { A: 1 })).toBe(true);
        expect(RuleEvaluator.evaluate(rule, { B: 2 })).toBe(true);
        expect(RuleEvaluator.evaluate(rule, { A: 1, B: 2 })).toBe(true);
      });

      it('should not satisfy when no child is satisfied', () => {
        const rule: RuleDefinition = {
          any: [
            { group: 'A', min: 2 },
            { group: 'B', min: 3 },
          ],
        };

        expect(RuleEvaluator.evaluate(rule, { A: 1, B: 2 })).toBe(false);
      });
    });

    describe('AND conditions (all)', () => {
      it('should satisfy when all children are satisfied', () => {
        // (1 from A) AND (1 from B)
        const rule: RuleDefinition = {
          all: [
            { group: 'A', min: 1 },
            { group: 'B', min: 1 },
          ],
        };

        expect(RuleEvaluator.evaluate(rule, { A: 1, B: 1 })).toBe(true);
      });

      it('should not satisfy when any child is not satisfied', () => {
        const rule: RuleDefinition = {
          all: [
            { group: 'A', min: 1 },
            { group: 'B', min: 1 },
          ],
        };

        expect(RuleEvaluator.evaluate(rule, { A: 1 })).toBe(false);
        expect(RuleEvaluator.evaluate(rule, { B: 1 })).toBe(false);
      });
    });

    describe('complex nested conditions', () => {
      it('should handle (1 from A) OR (2 from B) OR (1 from B AND 2 from C)', () => {
        const rule: RuleDefinition = {
          any: [
            { group: 'A', min: 1 },
            { group: 'B', min: 2 },
            {
              all: [
                { group: 'B', min: 1 },
                { group: 'C', min: 2 },
              ],
            },
          ],
        };

        // Satisfied by A
        expect(RuleEvaluator.evaluate(rule, { A: 1 })).toBe(true);

        // Satisfied by B
        expect(RuleEvaluator.evaluate(rule, { B: 2 })).toBe(true);

        // Satisfied by B+C combo
        expect(RuleEvaluator.evaluate(rule, { B: 1, C: 2 })).toBe(true);

        // Not satisfied
        expect(RuleEvaluator.evaluate(rule, { C: 2 })).toBe(false);
        expect(RuleEvaluator.evaluate(rule, { B: 1, C: 1 })).toBe(false);
      });

      it('should handle (3 from A) OR (1 from A AND 1 from B AND 2 from C)', () => {
        const rule: RuleDefinition = {
          any: [
            { group: 'A', min: 3 },
            {
              all: [
                { group: 'A', min: 1 },
                { group: 'B', min: 1 },
                { group: 'C', min: 2 },
              ],
            },
          ],
        };

        // Satisfied by 3 A
        expect(RuleEvaluator.evaluate(rule, { A: 3 })).toBe(true);

        // Satisfied by A+B+C combo
        expect(RuleEvaluator.evaluate(rule, { A: 1, B: 1, C: 2 })).toBe(true);

        // Not satisfied
        expect(RuleEvaluator.evaluate(rule, { A: 2 })).toBe(false);
        expect(RuleEvaluator.evaluate(rule, { A: 1, B: 1, C: 1 })).toBe(false);
      });

      it('should handle deeply nested (2 from A) AND ((1 from B) OR (2 from C))', () => {
        const rule: RuleDefinition = {
          all: [
            { group: 'A', min: 2 },
            {
              any: [
                { group: 'B', min: 1 },
                { group: 'C', min: 2 },
              ],
            },
          ],
        };

        // Satisfied with A and B
        expect(RuleEvaluator.evaluate(rule, { A: 2, B: 1 })).toBe(true);

        // Satisfied with A and C
        expect(RuleEvaluator.evaluate(rule, { A: 2, C: 2 })).toBe(true);

        // Not satisfied - missing A
        expect(RuleEvaluator.evaluate(rule, { A: 1, B: 1 })).toBe(false);

        // Not satisfied - missing B or C
        expect(RuleEvaluator.evaluate(rule, { A: 2 })).toBe(false);
      });
    });
  });

  describe('getPossibleCombinations', () => {
    it('should return single combination for simple rule', () => {
      const rule: RuleDefinition = { group: 'A', min: 2 };
      const combinations = RuleEvaluator.getPossibleCombinations(rule);

      expect(combinations).toEqual([{ A: 2 }]);
    });

    it('should return multiple combinations for OR rule', () => {
      const rule: RuleDefinition = {
        any: [
          { group: 'A', min: 1 },
          { group: 'B', min: 2 },
        ],
      };
      const combinations = RuleEvaluator.getPossibleCombinations(rule);

      expect(combinations).toHaveLength(2);
      expect(combinations).toContainEqual({ A: 1 });
      expect(combinations).toContainEqual({ B: 2 });
    });

    it('should return merged combination for AND rule', () => {
      const rule: RuleDefinition = {
        all: [
          { group: 'A', min: 1 },
          { group: 'B', min: 2 },
        ],
      };
      const combinations = RuleEvaluator.getPossibleCombinations(rule);

      expect(combinations).toEqual([{ A: 1, B: 2 }]);
    });

    it('should handle complex nested rules', () => {
      // (1 from A) OR (1 from B AND 2 from C)
      const rule: RuleDefinition = {
        any: [
          { group: 'A', min: 1 },
          {
            all: [
              { group: 'B', min: 1 },
              { group: 'C', min: 2 },
            ],
          },
        ],
      };
      const combinations = RuleEvaluator.getPossibleCombinations(rule);

      expect(combinations).toHaveLength(2);
      expect(combinations).toContainEqual({ A: 1 });
      expect(combinations).toContainEqual({ B: 1, C: 2 });
    });
  });

  describe('getRemainingRequired', () => {
    it('should return null when already satisfied', () => {
      const rule: RuleDefinition = { group: 'A', min: 2 };
      const counts: GroupSignatureCounts = { A: 2 };

      expect(RuleEvaluator.getRemainingRequired(rule, counts)).toBeNull();
    });

    it('should return remaining for simple rule', () => {
      const rule: RuleDefinition = { group: 'A', min: 3 };
      const counts: GroupSignatureCounts = { A: 1 };

      expect(RuleEvaluator.getRemainingRequired(rule, counts)).toEqual({
        A: 2,
      });
    });

    it('should return optimal remaining for OR rule', () => {
      const rule: RuleDefinition = {
        any: [
          { group: 'A', min: 3 },
          { group: 'B', min: 1 },
        ],
      };
      const counts: GroupSignatureCounts = {};

      // Should suggest B because it requires fewer signatures
      const remaining = RuleEvaluator.getRemainingRequired(rule, counts);
      expect(remaining).toEqual({ B: 1 });
    });

    it('should consider current progress when calculating remaining', () => {
      const rule: RuleDefinition = {
        any: [
          { group: 'A', min: 3 },
          { group: 'B', min: 2 },
        ],
      };
      const counts: GroupSignatureCounts = { A: 2 };

      // A needs 1 more, B needs 2 - should suggest A
      const remaining = RuleEvaluator.getRemainingRequired(rule, counts);
      expect(remaining).toEqual({ A: 1 });
    });
  });
});

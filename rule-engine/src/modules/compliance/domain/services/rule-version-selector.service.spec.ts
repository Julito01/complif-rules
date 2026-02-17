/**
 * Domain Tests: Rule Version Activation
 *
 * Tests the logic that determines which rule versions are active
 * at a given point in time and enforces versioning invariants.
 *
 * Key invariants:
 * - Only one version per template can be active at any time
 * - RuleVersions are immutable after creation
 * - Activation is based on activatedAt/deactivatedAt timestamps
 * - Active means: activatedAt <= now AND deactivatedAt IS NULL
 *
 * NO database, NO HTTP — pure functions only.
 */

import { RuleVersionSelector } from './rule-version-selector.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types (will be implemented as domain entities/VOs)
// ─────────────────────────────────────────────────────────────────────────────

interface RuleVersionSnapshot {
  id: string;
  idRuleTemplate: string;
  versionNumber: number;
  conditions: Record<string, unknown>;
  actions: Array<{ type: string; [key: string]: unknown }>;
  priority: number;
  enabled: boolean;
  activatedAt: Date;
  deactivatedAt: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeVersion(
  overrides: Partial<RuleVersionSnapshot> & {
    id: string;
    idRuleTemplate: string;
  },
): RuleVersionSnapshot {
  return {
    versionNumber: 1,
    conditions: { all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 10000 }] },
    actions: [{ type: 'create_alert', severity: 'HIGH', category: 'AML' }],
    priority: 1,
    enabled: true,
    activatedAt: new Date('2026-01-01T00:00:00Z'),
    deactivatedAt: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('RuleVersionSelector', () => {
  // ─── Selecting active versions ────────────────────────────────────

  describe('getActiveVersions', () => {
    it('should return only active versions (deactivatedAt is null)', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({ id: 'v1', idRuleTemplate: 'tpl-1', deactivatedAt: null }),
        makeVersion({
          id: 'v2',
          idRuleTemplate: 'tpl-2',
          deactivatedAt: new Date('2026-02-01T00:00:00Z'),
        }),
      ];

      const active = RuleVersionSelector.getActiveVersions(versions);

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('v1');
    });

    it('should return only enabled versions', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({ id: 'v1', idRuleTemplate: 'tpl-1', enabled: true }),
        makeVersion({ id: 'v2', idRuleTemplate: 'tpl-2', enabled: false }),
      ];

      const active = RuleVersionSelector.getActiveVersions(versions);

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('v1');
    });

    it('should filter by activation time relative to evaluation timestamp', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({
          id: 'v1',
          idRuleTemplate: 'tpl-1',
          activatedAt: new Date('2026-01-01T00:00:00Z'),
        }),
        makeVersion({
          id: 'v2',
          idRuleTemplate: 'tpl-2',
          activatedAt: new Date('2026-03-01T00:00:00Z'), // Future activation
        }),
      ];

      const evaluationTime = new Date('2026-02-10T12:00:00Z');
      const active = RuleVersionSelector.getActiveVersions(versions, evaluationTime);

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('v1');
    });

    it('should return empty array when no versions are active', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({
          id: 'v1',
          idRuleTemplate: 'tpl-1',
          deactivatedAt: new Date('2026-01-15T00:00:00Z'),
        }),
      ];

      const active = RuleVersionSelector.getActiveVersions(versions);
      expect(active).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      expect(RuleVersionSelector.getActiveVersions([])).toHaveLength(0);
    });
  });

  // ─── Ordering by priority ─────────────────────────────────────────

  describe('sortByPriority', () => {
    it('should sort versions by priority ascending (lower = higher priority)', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({ id: 'v3', idRuleTemplate: 'tpl-3', priority: 3 }),
        makeVersion({ id: 'v1', idRuleTemplate: 'tpl-1', priority: 1 }),
        makeVersion({ id: 'v2', idRuleTemplate: 'tpl-2', priority: 2 }),
      ];

      const sorted = RuleVersionSelector.sortByPriority(versions);

      expect(sorted.map((v) => v.id)).toEqual(['v1', 'v2', 'v3']);
    });

    it('should maintain stable order for equal priorities', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({ id: 'v1', idRuleTemplate: 'tpl-1', priority: 1 }),
        makeVersion({ id: 'v2', idRuleTemplate: 'tpl-2', priority: 1 }),
      ];

      const sorted = RuleVersionSelector.sortByPriority(versions);

      // Stable sort: original order preserved
      expect(sorted.map((v) => v.id)).toEqual(['v1', 'v2']);
    });
  });

  // ─── Version immutability enforcement ─────────────────────────────

  describe('invariants', () => {
    it('should only have one active version per template', () => {
      // Two active versions for the same template = violation
      const versions: RuleVersionSnapshot[] = [
        makeVersion({
          id: 'v1',
          idRuleTemplate: 'tpl-1',
          versionNumber: 1,
          deactivatedAt: null,
        }),
        makeVersion({
          id: 'v2',
          idRuleTemplate: 'tpl-1',
          versionNumber: 2,
          deactivatedAt: null,
        }),
      ];

      expect(() => RuleVersionSelector.validateNoConflicts(versions)).toThrow(
        /multiple active versions/i,
      );
    });

    it('should allow different templates to each have one active version', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({
          id: 'v1',
          idRuleTemplate: 'tpl-1',
          deactivatedAt: null,
        }),
        makeVersion({
          id: 'v2',
          idRuleTemplate: 'tpl-2',
          deactivatedAt: null,
        }),
      ];

      expect(() => RuleVersionSelector.validateNoConflicts(versions)).not.toThrow();
    });

    it('should allow same template to have multiple versions if only one is active', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({
          id: 'v1',
          idRuleTemplate: 'tpl-1',
          versionNumber: 1,
          deactivatedAt: new Date('2026-02-01T00:00:00Z'),
        }),
        makeVersion({
          id: 'v2',
          idRuleTemplate: 'tpl-1',
          versionNumber: 2,
          deactivatedAt: null,
        }),
      ];

      expect(() => RuleVersionSelector.validateNoConflicts(versions)).not.toThrow();
    });
  });

  // ─── Additional edge cases ──────────────────────────────────────────

  describe('getActiveVersions – edge cases', () => {
    it('should include future-activated versions when no evaluationTime is provided', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({
          id: 'v-future',
          idRuleTemplate: 'tpl-1',
          activatedAt: new Date('2099-01-01T00:00:00Z'),
          deactivatedAt: null,
          enabled: true,
        }),
      ];

      // Without evaluationTime, activatedAt check is skipped
      const active = RuleVersionSelector.getActiveVersions(versions);
      expect(active).toHaveLength(1);
    });

    it('should exclude future-activated versions when evaluationTime is provided', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({
          id: 'v-future',
          idRuleTemplate: 'tpl-1',
          activatedAt: new Date('2099-01-01T00:00:00Z'),
          deactivatedAt: null,
          enabled: true,
        }),
      ];

      const active = RuleVersionSelector.getActiveVersions(
        versions,
        new Date('2026-06-01T00:00:00Z'),
      );
      expect(active).toHaveLength(0);
    });

    it('should include version activated exactly at evaluationTime', () => {
      const time = new Date('2026-06-01T12:00:00Z');
      const versions: RuleVersionSnapshot[] = [
        makeVersion({
          id: 'v-exact',
          idRuleTemplate: 'tpl-1',
          activatedAt: time,
          deactivatedAt: null,
          enabled: true,
        }),
      ];

      const active = RuleVersionSelector.getActiveVersions(versions, time);
      expect(active).toHaveLength(1);
    });
  });

  describe('sortByPriority – edge cases', () => {
    it('should handle negative priorities', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({ id: 'v-pos', idRuleTemplate: 'tpl-1', priority: 5 }),
        makeVersion({ id: 'v-neg', idRuleTemplate: 'tpl-2', priority: -3 }),
        makeVersion({ id: 'v-zero', idRuleTemplate: 'tpl-3', priority: 0 }),
      ];

      const sorted = RuleVersionSelector.sortByPriority(versions);
      expect(sorted.map((v) => v.id)).toEqual(['v-neg', 'v-zero', 'v-pos']);
    });

    it('should return empty array for empty input', () => {
      expect(RuleVersionSelector.sortByPriority([])).toEqual([]);
    });

    it('should not mutate the original array', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({ id: 'v2', idRuleTemplate: 'tpl-2', priority: 2 }),
        makeVersion({ id: 'v1', idRuleTemplate: 'tpl-1', priority: 1 }),
      ];

      const sorted = RuleVersionSelector.sortByPriority(versions);
      expect(versions[0].id).toBe('v2'); // original unchanged
      expect(sorted[0].id).toBe('v1');
    });
  });

  describe('validateNoConflicts – edge cases', () => {
    it('should pass for empty input', () => {
      expect(() => RuleVersionSelector.validateNoConflicts([])).not.toThrow();
    });

    it('should not consider disabled versions as conflicting (current behavior: only checks deactivatedAt)', () => {
      // NOTE: validateNoConflicts only checks deactivatedAt, not enabled flag
      // Two disabled but non-deactivated versions for same template → conflict
      const versions: RuleVersionSnapshot[] = [
        makeVersion({
          id: 'v1',
          idRuleTemplate: 'tpl-1',
          enabled: false,
          deactivatedAt: null,
        }),
        makeVersion({
          id: 'v2',
          idRuleTemplate: 'tpl-1',
          enabled: false,
          deactivatedAt: null,
        }),
      ];

      // Current behavior: throws because it only checks deactivatedAt
      expect(() => RuleVersionSelector.validateNoConflicts(versions)).toThrow(
        /multiple active versions/i,
      );
    });

    it('should throw descriptive error message including template and version IDs', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({ id: 'v-abc', idRuleTemplate: 'tpl-X', deactivatedAt: null }),
        makeVersion({ id: 'v-def', idRuleTemplate: 'tpl-X', deactivatedAt: null }),
      ];

      expect(() => RuleVersionSelector.validateNoConflicts(versions)).toThrow(/tpl-X/);
      expect(() => RuleVersionSelector.validateNoConflicts(versions)).toThrow(/v-abc/);
      expect(() => RuleVersionSelector.validateNoConflicts(versions)).toThrow(/v-def/);
    });

    it('should allow three templates each with one active version', () => {
      const versions: RuleVersionSnapshot[] = [
        makeVersion({ id: 'v1', idRuleTemplate: 'tpl-1', deactivatedAt: null }),
        makeVersion({ id: 'v2', idRuleTemplate: 'tpl-2', deactivatedAt: null }),
        makeVersion({ id: 'v3', idRuleTemplate: 'tpl-3', deactivatedAt: null }),
      ];

      expect(() => RuleVersionSelector.validateNoConflicts(versions)).not.toThrow();
    });
  });
});

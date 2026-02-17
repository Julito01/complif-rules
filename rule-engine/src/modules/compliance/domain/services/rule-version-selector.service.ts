/**
 * Rule Version Selector - Domain Service
 *
 * Pure, stateless service to select and validate active rule versions.
 * No database, no side effects — just filtering and validation.
 *
 * Key invariants:
 *   - Only one active version per template at any time
 *   - Active = enabled + deactivatedAt IS NULL + activatedAt <= evaluationTime
 *   - Versions are sorted by priority ascending (lower number = higher priority)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RuleVersionSnapshot {
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
// Selector (static, pure)
// ─────────────────────────────────────────────────────────────────────────────

export class RuleVersionSelector {
  /**
   * Get active rule versions at a given evaluation time.
   *
   * Active means:
   *   - enabled === true
   *   - deactivatedAt === null
   *   - activatedAt <= evaluationTime (if provided)
   *
   * @param versions - All candidate rule versions
   * @param evaluationTime - Optional: filter by activation time. Defaults to "now" but only for filter purposes.
   * @returns Active versions
   */
  static getActiveVersions(
    versions: RuleVersionSnapshot[],
    evaluationTime?: Date,
  ): RuleVersionSnapshot[] {
    return versions.filter((v) => {
      // Must be enabled
      if (!v.enabled) return false;

      // Must not be deactivated
      if (v.deactivatedAt !== null) return false;

      // If evaluationTime is provided, check activatedAt
      if (evaluationTime && v.activatedAt.getTime() > evaluationTime.getTime()) {
        return false;
      }

      return true;
    });
  }

  /**
   * Sort versions by priority ascending (lower number = higher priority).
   * Stable sort — preserves insertion order for equal priorities.
   */
  static sortByPriority(versions: RuleVersionSnapshot[]): RuleVersionSnapshot[] {
    return [...versions].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Validate that no template has multiple active versions.
   * Throws if the invariant is violated.
   */
  static validateNoConflicts(versions: RuleVersionSnapshot[]): void {
    const activeByTemplate = new Map<string, string[]>();

    for (const v of versions) {
      if (v.deactivatedAt !== null) continue; // Skip deactivated

      const existing = activeByTemplate.get(v.idRuleTemplate) || [];
      existing.push(v.id);
      activeByTemplate.set(v.idRuleTemplate, existing);
    }

    for (const [templateId, versionIds] of activeByTemplate) {
      if (versionIds.length > 1) {
        throw new Error(
          `Multiple active versions found for template "${templateId}": ` +
            `[${versionIds.join(', ')}]. Only one active version per template is allowed.`,
        );
      }
    }
  }
}

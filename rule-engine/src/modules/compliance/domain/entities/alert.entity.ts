import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { WindowSpec } from '../value-objects/window-spec.vo';

/**
 * Alert - generated when a rule evaluation results in a REVIEW or BLOCK decision.
 *
 * Alerts are deduplicated per (idAccount, idRuleVersion, windowStart) via dedupKey.
 * Within one dedup window, only the first active alert survives; subsequent triggers
 * are suppressed and tracked in the metadata of the original alert.
 */
@Entity('alerts')
@Index('idx_alert_dedup_key', ['idOrganization', 'dedupKey'])
@Index('idx_alert_org_status', ['idOrganization', 'status'])
@Index('idx_alert_account', ['idAccount'])
export class Alert extends BaseEntity {
  @Column({ name: 'id_evaluation_result', type: 'uuid' })
  idEvaluationResult: string;

  @Column({ name: 'id_rule_version', type: 'uuid' })
  idRuleVersion: string;

  @Column({ name: 'id_transaction', type: 'uuid' })
  idTransaction: string;

  @Column({ name: 'id_account', type: 'uuid' })
  idAccount: string;

  /**
   * Stable dedup key: `${idAccount}:${idRuleVersion}:${windowStartISO}`.
   * For rules without a window, windowStart defaults to the calendar day.
   */
  @Column({ name: 'dedup_key', type: 'varchar', length: 255, default: 'legacy' })
  dedupKey: string;

  @Column({ type: 'varchar', length: 20 })
  severity: string;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: string;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'resolved_at', type: 'timestamp with time zone', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  /**
   * Count of suppressed duplicate triggers consolidated into this alert.
   */
  @Column({ name: 'suppressed_count', type: 'int', default: 0 })
  suppressedCount: number;

  // ── Static helpers ─────────────────────────────────────────────

  /**
   * Compute a deterministic dedup key from account, rule, and window.
   */
  static computeDedupKey(
    idAccount: string,
    idRuleVersion: string,
    transactionDatetime: Date,
    window: WindowSpec | null,
  ): string {
    const windowStart = Alert.computeWindowStart(transactionDatetime, window);
    return `${idAccount}:${idRuleVersion}:${windowStart}`;
  }

  /**
   * Compute a deterministic window start boundary.
   * - With window: align to the start of the sliding window (anchor − duration).
   * - Without window: use the calendar day (UTC midnight) as the boundary.
   */
  static computeWindowStart(transactionDatetime: Date, window: WindowSpec | null): string {
    if (!window) {
      // Default: calendar day boundary (UTC midnight)
      const d = new Date(transactionDatetime);
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString();
    }

    let durationMs: number;
    switch (window.unit) {
      case 'minutes':
        durationMs = window.duration * 60 * 1000;
        break;
      case 'hours':
        durationMs = window.duration * 60 * 60 * 1000;
        break;
      case 'days':
        durationMs = window.duration * 24 * 60 * 60 * 1000;
        break;
      default:
        durationMs = window.duration * 60 * 60 * 1000; // default hours
    }

    // Quantize to window-duration bucket so all transactions in the same
    // bucket produce the same dedup key (avoids per-millisecond anchoring).
    const epochMs = transactionDatetime.getTime();
    const bucketMs = Math.floor(epochMs / durationMs) * durationMs;
    return new Date(bucketMs).toISOString();
  }
}

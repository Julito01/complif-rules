/**
 * Window Calculator - Domain Service
 *
 * Pure, stateless service for sliding window computations.
 * No database, no side effects — just math.
 *
 * Key invariants:
 *   - Windows are anchored to a transaction's datetime, NEVER to now()
 *   - Boundaries are [start, end) — inclusive start, exclusive end
 *   - The anchor transaction itself is NOT within its own window
 *   - Aggregations are recomputed at evaluation time, never stored
 */

import { WindowSpec, WindowBounds } from '../value-objects/window-spec.vo';
import { AggregationType } from '../value-objects/action-definition.vo';

// ─────────────────────────────────────────────────────────────────────────────
// Minimal transaction shape for window filtering + aggregation
// ─────────────────────────────────────────────────────────────────────────────

interface TransactionForWindow {
  id: string;
  datetime: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Window Calculator (static, pure)
// ─────────────────────────────────────────────────────────────────────────────

export class WindowCalculator {
  /**
   * Compute the [start, end) bounds of a sliding window.
   *
   * @param anchor - The anchor timestamp (transaction.datetime)
   * @param window - Window duration + unit
   * @returns { start (inclusive), end (exclusive = anchor) }
   */
  static computeWindowBounds(anchor: Date, window: WindowSpec): WindowBounds {
    const anchorMs = anchor.getTime();
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
        throw new Error(`Unsupported window unit: ${window.unit}`);
    }

    return {
      start: new Date(anchorMs - durationMs),
      end: new Date(anchorMs),
    };
  }

  /**
   * Filter transactions that fall within a sliding window.
   * Window is [start, end) — inclusive start, exclusive end.
   * The anchor transaction (at exactly `end`) is excluded.
   *
   * @param transactions - All candidate transactions
   * @param anchor - Anchor timestamp (the evaluated transaction's datetime)
   * @param window - Window spec
   * @returns Transactions within the window
   */
  static filterTransactionsInWindow<T extends TransactionForWindow>(
    transactions: T[],
    anchor: Date,
    window: WindowSpec,
  ): T[] {
    const bounds = this.computeWindowBounds(anchor, window);

    return transactions.filter((tx) => {
      const txTime = tx.datetime.getTime();
      return txTime >= bounds.start.getTime() && txTime < bounds.end.getTime();
    });
  }

  /**
   * Compute an aggregation over a set of transactions.
   *
   * @param transactions - Pre-filtered transactions within the window
   * @param type - Aggregation type (COUNT, SUM, AVG, MAX, MIN)
   * @param field - Field to aggregate (required for SUM, AVG, MAX, MIN)
   * @returns Aggregation result, or null for AVG/MAX/MIN on empty sets
   */
  static aggregate<T extends TransactionForWindow>(
    transactions: T[],
    type: AggregationType | string,
    field?: string,
  ): number | null {
    const aggType = type.toUpperCase() as AggregationType;

    if (aggType === 'COUNT') {
      return transactions.length;
    }

    if (!field) {
      throw new Error(`Field is required for ${aggType} aggregation`);
    }

    const values = transactions
      .map((tx) => (tx as Record<string, unknown>)[field])
      .filter((v): v is number => typeof v === 'number');

    if (values.length === 0) {
      // SUM of empty set = 0, others = null
      if (aggType === 'SUM') return 0;
      return null;
    }

    switch (aggType) {
      case 'SUM':
        return values.reduce((sum, v) => sum + v, 0);
      case 'AVG':
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      case 'MAX':
        return Math.max(...values);
      case 'MIN':
        return Math.min(...values);
      default:
        throw new Error(`Unsupported aggregation type: ${aggType}`);
    }
  }
}

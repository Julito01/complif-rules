/**
 * Domain Tests: Sliding Window Boundaries
 *
 * Tests the window computation logic that determines which transactions
 * fall within a sliding window anchored to a given transaction's datetime.
 *
 * Key invariants:
 * - Windows are anchored to transaction.datetime, NEVER to now()
 * - Window boundaries are [start, anchor) — inclusive start, exclusive end
 * - The anchor transaction itself is NOT included in its own window
 * - Empty windows produce zero/null aggregation results
 *
 * NO database, NO HTTP — pure functions only.
 */

import { WindowCalculator } from './window-calculator.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types (will be implemented as value objects)
// ─────────────────────────────────────────────────────────────────────────────

interface WindowSpec {
  duration: number;
  unit: 'minutes' | 'hours' | 'days';
}

interface Transaction {
  id: string;
  datetime: Date;
  amount: number;
  type: string;
  idAccount: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<Transaction> & { datetime: Date }): Transaction {
  return {
    id: overrides.id || 'tx-test',
    datetime: overrides.datetime,
    amount: overrides.amount || 100,
    type: overrides.type || 'CASH_OUT',
    idAccount: overrides.idAccount || 'account-1',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('WindowCalculator', () => {
  // ─── Window boundary computation ──────────────────────────────────

  describe('computeWindowBounds', () => {
    it('should compute 24h window anchored to transaction datetime', () => {
      const anchor = new Date('2026-02-10T12:00:00Z');
      const window: WindowSpec = { duration: 24, unit: 'hours' };

      const bounds = WindowCalculator.computeWindowBounds(anchor, window);

      expect(bounds.start).toEqual(new Date('2026-02-09T12:00:00Z'));
      expect(bounds.end).toEqual(new Date('2026-02-10T12:00:00Z'));
    });

    it('should compute 7-day window', () => {
      const anchor = new Date('2026-02-10T12:00:00Z');
      const window: WindowSpec = { duration: 7, unit: 'days' };

      const bounds = WindowCalculator.computeWindowBounds(anchor, window);

      expect(bounds.start).toEqual(new Date('2026-02-03T12:00:00Z'));
      expect(bounds.end).toEqual(new Date('2026-02-10T12:00:00Z'));
    });

    it('should compute 30-minute window', () => {
      const anchor = new Date('2026-02-10T12:30:00Z');
      const window: WindowSpec = { duration: 30, unit: 'minutes' };

      const bounds = WindowCalculator.computeWindowBounds(anchor, window);

      expect(bounds.start).toEqual(new Date('2026-02-10T12:00:00Z'));
      expect(bounds.end).toEqual(new Date('2026-02-10T12:30:00Z'));
    });

    it('should NOT use now() — window is always relative to anchor', () => {
      // Two calls with same anchor should produce identical bounds
      const anchor = new Date('2025-01-01T00:00:00Z'); // Date in the past
      const window: WindowSpec = { duration: 24, unit: 'hours' };

      const bounds1 = WindowCalculator.computeWindowBounds(anchor, window);
      const bounds2 = WindowCalculator.computeWindowBounds(anchor, window);

      // Deterministic — same result regardless of wall clock
      expect(bounds1.start).toEqual(bounds2.start);
      expect(bounds1.end).toEqual(bounds2.end);
      expect(bounds1.start).toEqual(new Date('2024-12-31T00:00:00Z'));
    });
  });

  // ─── Filtering transactions within a window ──────────────────────

  describe('filterTransactionsInWindow', () => {
    const anchorDate = new Date('2026-02-10T12:00:00Z');
    const window24h: WindowSpec = { duration: 24, unit: 'hours' };

    it('should include transactions within the window', () => {
      const transactions = [
        makeTx({ id: 'inside-1', datetime: new Date('2026-02-10T11:00:00Z') }),
        makeTx({ id: 'inside-2', datetime: new Date('2026-02-09T13:00:00Z') }),
      ];

      const result = WindowCalculator.filterTransactionsInWindow(
        transactions,
        anchorDate,
        window24h,
      );

      expect(result).toHaveLength(2);
    });

    it('should exclude the anchor transaction itself (exclusive end)', () => {
      const transactions = [
        makeTx({
          id: 'anchor-tx',
          datetime: new Date('2026-02-10T12:00:00Z'),
        }),
        makeTx({ id: 'inside', datetime: new Date('2026-02-10T11:00:00Z') }),
      ];

      const result = WindowCalculator.filterTransactionsInWindow(
        transactions,
        anchorDate,
        window24h,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('inside');
    });

    it('should include transactions exactly at window start (inclusive)', () => {
      const transactions = [
        makeTx({
          id: 'at-boundary',
          datetime: new Date('2026-02-09T12:00:00Z'),
        }),
      ];

      const result = WindowCalculator.filterTransactionsInWindow(
        transactions,
        anchorDate,
        window24h,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('at-boundary');
    });

    it('should exclude transactions before window start', () => {
      const transactions = [
        makeTx({
          id: 'too-old',
          datetime: new Date('2026-02-09T11:59:59Z'),
        }),
      ];

      const result = WindowCalculator.filterTransactionsInWindow(
        transactions,
        anchorDate,
        window24h,
      );

      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      const result = WindowCalculator.filterTransactionsInWindow([], anchorDate, window24h);
      expect(result).toHaveLength(0);
    });
  });

  // ─── Aggregation computations ─────────────────────────────────────

  describe('aggregate', () => {
    const transactions = [
      makeTx({
        id: 'tx-1',
        datetime: new Date('2026-02-10T11:00:00Z'),
        amount: 1000,
      }),
      makeTx({
        id: 'tx-2',
        datetime: new Date('2026-02-10T10:00:00Z'),
        amount: 2000,
      }),
      makeTx({
        id: 'tx-3',
        datetime: new Date('2026-02-10T09:00:00Z'),
        amount: 3000,
      }),
    ];

    it('should compute COUNT', () => {
      expect(WindowCalculator.aggregate(transactions, 'COUNT')).toBe(3);
    });

    it('should compute SUM of amounts', () => {
      expect(WindowCalculator.aggregate(transactions, 'SUM', 'amount')).toBe(6000);
    });

    it('should compute AVG of amounts', () => {
      expect(WindowCalculator.aggregate(transactions, 'AVG', 'amount')).toBe(2000);
    });

    it('should compute MAX of amounts', () => {
      expect(WindowCalculator.aggregate(transactions, 'MAX', 'amount')).toBe(3000);
    });

    it('should compute MIN of amounts', () => {
      expect(WindowCalculator.aggregate(transactions, 'MIN', 'amount')).toBe(1000);
    });

    it('should return 0 for COUNT on empty set', () => {
      expect(WindowCalculator.aggregate([], 'COUNT')).toBe(0);
    });

    it('should return 0 for SUM on empty set', () => {
      expect(WindowCalculator.aggregate([], 'SUM', 'amount')).toBe(0);
    });

    it('should return null for AVG on empty set', () => {
      expect(WindowCalculator.aggregate([], 'AVG', 'amount')).toBeNull();
    });

    it('should return null for MAX on empty set', () => {
      expect(WindowCalculator.aggregate([], 'MAX', 'amount')).toBeNull();
    });

    it('should return null for MIN on empty set', () => {
      expect(WindowCalculator.aggregate([], 'MIN', 'amount')).toBeNull();
    });
  });

  // ─── Cross-boundary edge cases ────────────────────────────────────

  describe('edge cases', () => {
    it('should handle midnight boundary correctly', () => {
      const anchor = new Date('2026-02-10T00:00:00Z');
      const window: WindowSpec = { duration: 1, unit: 'hours' };

      const bounds = WindowCalculator.computeWindowBounds(anchor, window);

      expect(bounds.start).toEqual(new Date('2026-02-09T23:00:00Z'));
      expect(bounds.end).toEqual(new Date('2026-02-10T00:00:00Z'));
    });

    it('should handle DST-like boundary (month rollover)', () => {
      const anchor = new Date('2026-03-01T02:00:00Z');
      const window: WindowSpec = { duration: 3, unit: 'days' };

      const bounds = WindowCalculator.computeWindowBounds(anchor, window);

      expect(bounds.start).toEqual(new Date('2026-02-26T02:00:00Z'));
      expect(bounds.end).toEqual(new Date('2026-03-01T02:00:00Z'));
    });

    it('should handle very small window (1 minute)', () => {
      const anchor = new Date('2026-02-10T12:05:00Z');
      const window: WindowSpec = { duration: 1, unit: 'minutes' };

      const bounds = WindowCalculator.computeWindowBounds(anchor, window);

      expect(bounds.start).toEqual(new Date('2026-02-10T12:04:00Z'));
      expect(bounds.end).toEqual(new Date('2026-02-10T12:05:00Z'));
    });

    it('should handle large window (30 days)', () => {
      const anchor = new Date('2026-02-10T12:00:00Z');
      const window: WindowSpec = { duration: 30, unit: 'days' };

      const bounds = WindowCalculator.computeWindowBounds(anchor, window);

      expect(bounds.start).toEqual(new Date('2026-01-11T12:00:00Z'));
    });

    it('should throw for unsupported window unit', () => {
      const anchor = new Date('2026-02-10T12:00:00Z');
      const window = { duration: 5, unit: 'weeks' } as unknown as WindowSpec;

      expect(() => WindowCalculator.computeWindowBounds(anchor, window)).toThrow(
        'Unsupported window unit',
      );
    });

    it('should handle zero-duration window (start === end)', () => {
      const anchor = new Date('2026-02-10T12:00:00Z');
      const window: WindowSpec = { duration: 0, unit: 'hours' };

      const bounds = WindowCalculator.computeWindowBounds(anchor, window);
      expect(bounds.start).toEqual(bounds.end);
    });

    it('should handle year boundary crossing', () => {
      const anchor = new Date('2026-01-01T02:00:00Z');
      const window: WindowSpec = { duration: 3, unit: 'days' };

      const bounds = WindowCalculator.computeWindowBounds(anchor, window);

      expect(bounds.start).toEqual(new Date('2025-12-29T02:00:00Z'));
      expect(bounds.end).toEqual(new Date('2026-01-01T02:00:00Z'));
    });
  });

  describe('aggregate error paths', () => {
    it('should throw for unsupported aggregation type', () => {
      const txs = [{ id: 'tx-1', amount: 100, datetime: new Date() }];
      expect(() => WindowCalculator.aggregate(txs, 'MEDIAN' as any, 'amount')).toThrow();
    });

    it('should throw for non-COUNT aggregation without field', () => {
      const txs = [{ id: 'tx-1', amount: 100, datetime: new Date() }];
      expect(() => WindowCalculator.aggregate(txs, 'SUM')).toThrow();
    });
  });
});

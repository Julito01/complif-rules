import { Alert } from './alert.entity';
import { WindowSpec } from '../value-objects/window-spec.vo';

describe('Alert – dedupKey computation', () => {
  const accountId = '00000000-0000-4000-a000-000000000001';
  const ruleVersionId = '00000000-0000-4000-b000-000000000010';

  describe('computeWindowStart', () => {
    it('should default to UTC midnight when no window is defined', () => {
      const datetime = new Date('2025-06-15T14:30:00.000Z');
      const result = Alert.computeWindowStart(datetime, null);
      expect(result).toBe('2025-06-15T00:00:00.000Z');
    });

    it('should quantize to 24h bucket for hours window', () => {
      const datetime = new Date('2025-06-15T14:30:00.000Z');
      const window: WindowSpec = { duration: 24, unit: 'hours' };
      const result = Alert.computeWindowStart(datetime, window);
      // 24h = 86400000ms; floor(datetime_ms / 86400000) * 86400000 → UTC midnight
      expect(result).toBe('2025-06-15T00:00:00.000Z');
    });

    it('should produce same bucket for two timestamps within same 24h window', () => {
      const window: WindowSpec = { duration: 24, unit: 'hours' };
      const dt1 = new Date('2025-06-15T10:30:00.000Z');
      const dt2 = new Date('2025-06-15T10:30:05.000Z');
      expect(Alert.computeWindowStart(dt1, window)).toBe(Alert.computeWindowStart(dt2, window));
    });

    it('should quantize to 30min bucket for minutes window', () => {
      const datetime = new Date('2025-06-15T14:30:00.000Z');
      const window: WindowSpec = { duration: 30, unit: 'minutes' };
      const result = Alert.computeWindowStart(datetime, window);
      // 30min = 1800000ms; floor(14:30 epoch / 1800000) * 1800000 → 14:30:00 (exact boundary)
      expect(result).toBe('2025-06-15T14:30:00.000Z');
    });

    it('should quantize to 7-day bucket for days window', () => {
      const datetime = new Date('2025-06-15T14:30:00.000Z');
      const window: WindowSpec = { duration: 7, unit: 'days' };
      const result = Alert.computeWindowStart(datetime, window);
      // 7 days = 604800000ms; floor(datetime_ms / 604800000) * 604800000
      const epochMs = datetime.getTime();
      const expected = new Date(Math.floor(epochMs / 604800000) * 604800000).toISOString();
      expect(result).toBe(expected);
    });
  });

  describe('computeDedupKey', () => {
    it('should produce a key with account:rule:windowStart format', () => {
      const datetime = new Date('2025-06-15T14:30:00.000Z');
      const key = Alert.computeDedupKey(accountId, ruleVersionId, datetime, null);
      expect(key).toBe(`${accountId}:${ruleVersionId}:2025-06-15T00:00:00.000Z`);
    });

    it('should produce identical keys for two transactions within the same window', () => {
      const window: WindowSpec = { duration: 24, unit: 'hours' };
      // Same anchor = same window start
      const dt = new Date('2025-06-15T14:30:00.000Z');
      const key1 = Alert.computeDedupKey(accountId, ruleVersionId, dt, window);
      const key2 = Alert.computeDedupKey(accountId, ruleVersionId, dt, window);
      expect(key1).toBe(key2);
    });

    it('should produce different keys for different accounts', () => {
      const datetime = new Date('2025-06-15T14:30:00.000Z');
      const key1 = Alert.computeDedupKey(accountId, ruleVersionId, datetime, null);
      const key2 = Alert.computeDedupKey(
        '00000000-0000-4000-a000-000000000099',
        ruleVersionId,
        datetime,
        null,
      );
      expect(key1).not.toBe(key2);
    });

    it('should produce different keys for different rule versions', () => {
      const datetime = new Date('2025-06-15T14:30:00.000Z');
      const key1 = Alert.computeDedupKey(accountId, ruleVersionId, datetime, null);
      const key2 = Alert.computeDedupKey(
        accountId,
        '00000000-0000-4000-b000-000000000099',
        datetime,
        null,
      );
      expect(key1).not.toBe(key2);
    });

    it('should produce different keys across day boundaries without a window', () => {
      const day1 = new Date('2025-06-15T23:59:00.000Z');
      const day2 = new Date('2025-06-16T00:01:00.000Z');
      const key1 = Alert.computeDedupKey(accountId, ruleVersionId, day1, null);
      const key2 = Alert.computeDedupKey(accountId, ruleVersionId, day2, null);
      expect(key1).not.toBe(key2);
    });

    it('should produce different keys when transactions are outside window range', () => {
      const window: WindowSpec = { duration: 1, unit: 'hours' };
      // Two transactions 2 hours apart → different window starts
      const dt1 = new Date('2025-06-15T10:00:00.000Z');
      const dt2 = new Date('2025-06-15T12:00:00.000Z');
      const key1 = Alert.computeDedupKey(accountId, ruleVersionId, dt1, window);
      const key2 = Alert.computeDedupKey(accountId, ruleVersionId, dt2, window);
      expect(key1).not.toBe(key2);
    });
  });
});

import { SignatureRequest } from './signature-request.entity';
import { SignatureRequestStatus } from '../value-objects/signature-request-status.vo';
import { SignatureStatus } from '../value-objects/signature-status.vo';

function makeRequest(
  status: SignatureRequestStatus = SignatureRequestStatus.CREATED,
): SignatureRequest {
  const req = new SignatureRequest();
  req.status = status;
  req.signatures = [];
  return req;
}

describe('SignatureRequest Entity', () => {
  // ---------- markInProgress ----------
  describe('markInProgress()', () => {
    it('should transition CREATED → IN_PROGRESS', () => {
      const req = makeRequest(SignatureRequestStatus.CREATED);
      req.markInProgress();
      expect(req.status).toBe(SignatureRequestStatus.IN_PROGRESS);
    });

    it('should throw if already IN_PROGRESS', () => {
      const req = makeRequest(SignatureRequestStatus.IN_PROGRESS);
      expect(() => req.markInProgress()).toThrow();
    });

    it('should throw if COMPLETED', () => {
      const req = makeRequest(SignatureRequestStatus.COMPLETED);
      expect(() => req.markInProgress()).toThrow();
    });
  });

  // ---------- complete ----------
  describe('complete()', () => {
    it('should transition CREATED → COMPLETED', () => {
      const req = makeRequest(SignatureRequestStatus.CREATED);
      req.complete();
      expect(req.status).toBe(SignatureRequestStatus.COMPLETED);
      expect(req.completedAt).toBeInstanceOf(Date);
    });

    it('should transition IN_PROGRESS → COMPLETED', () => {
      const req = makeRequest(SignatureRequestStatus.IN_PROGRESS);
      req.complete();
      expect(req.status).toBe(SignatureRequestStatus.COMPLETED);
    });

    it('should throw if already COMPLETED', () => {
      const req = makeRequest(SignatureRequestStatus.COMPLETED);
      expect(() => req.complete()).toThrow(/terminal status|Cannot complete/);
    });

    it('should throw if CANCELLED', () => {
      const req = makeRequest(SignatureRequestStatus.CANCELLED);
      expect(() => req.complete()).toThrow();
    });
  });

  // ---------- cancel ----------
  describe('cancel()', () => {
    it('should transition CREATED → CANCELLED', () => {
      const req = makeRequest(SignatureRequestStatus.CREATED);
      req.cancel();
      expect(req.status).toBe(SignatureRequestStatus.CANCELLED);
    });

    it('should throw if already COMPLETED', () => {
      const req = makeRequest(SignatureRequestStatus.COMPLETED);
      expect(() => req.cancel()).toThrow();
    });
  });

  // ---------- reject ----------
  describe('reject()', () => {
    it('should transition CREATED → REJECTED', () => {
      const req = makeRequest(SignatureRequestStatus.CREATED);
      req.reject();
      expect(req.status).toBe(SignatureRequestStatus.REJECTED);
    });

    it('should throw if already EXPIRED', () => {
      const req = makeRequest(SignatureRequestStatus.EXPIRED);
      expect(() => req.reject()).toThrow();
    });
  });

  // ---------- expire ----------
  describe('expire()', () => {
    it('should transition IN_PROGRESS → EXPIRED', () => {
      const req = makeRequest(SignatureRequestStatus.IN_PROGRESS);
      req.expire();
      expect(req.status).toBe(SignatureRequestStatus.EXPIRED);
    });

    it('should throw if already REJECTED', () => {
      const req = makeRequest(SignatureRequestStatus.REJECTED);
      expect(() => req.expire()).toThrow();
    });
  });

  // ---------- isTerminal ----------
  describe('isTerminal()', () => {
    it.each([
      [SignatureRequestStatus.COMPLETED, true],
      [SignatureRequestStatus.REJECTED, true],
      [SignatureRequestStatus.CANCELLED, true],
      [SignatureRequestStatus.EXPIRED, true],
      [SignatureRequestStatus.CREATED, false],
      [SignatureRequestStatus.IN_PROGRESS, false],
    ])('status %s → isTerminal=%s', (status, expected) => {
      const req = makeRequest(status);
      expect(req.isTerminal()).toBe(expected);
    });
  });

  // ---------- getSignatureCountsByGroup ----------
  describe('getSignatureCountsByGroup()', () => {
    it('should return empty map when no signatures', () => {
      const req = makeRequest();
      req.signatures = [];
      expect(req.getSignatureCountsByGroup().size).toBe(0);
    });

    it('should return empty map when signatures is undefined', () => {
      const req = makeRequest();
      req.signatures = undefined as any;
      expect(req.getSignatureCountsByGroup().size).toBe(0);
    });

    it('should count only SIGNED signatures per group', () => {
      const req = makeRequest();
      req.signatures = [
        { status: SignatureStatus.SIGNED, group: { code: 'A' } } as any,
        { status: SignatureStatus.SIGNED, group: { code: 'A' } } as any,
        { status: SignatureStatus.PENDING, group: { code: 'A' } } as any,
        { status: SignatureStatus.SIGNED, group: { code: 'B' } } as any,
        { status: SignatureStatus.REJECTED, group: { code: 'B' } } as any,
      ];

      const counts = req.getSignatureCountsByGroup();
      expect(counts.get('A')).toBe(2);
      expect(counts.get('B')).toBe(1);
    });

    it('should skip signatures without a group', () => {
      const req = makeRequest();
      req.signatures = [
        { status: SignatureStatus.SIGNED, group: null } as any,
        { status: SignatureStatus.SIGNED, group: { code: 'X' } } as any,
      ];
      const counts = req.getSignatureCountsByGroup();
      expect(counts.get('X')).toBe(1);
      expect(counts.size).toBe(1);
    });
  });
});

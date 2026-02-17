import { Signature } from './signature.entity';
import { SignatureStatus } from '../value-objects/signature-status.vo';

function makeSig(status: SignatureStatus = SignatureStatus.PENDING): Signature {
  const sig = new Signature();
  sig.status = status;
  return sig;
}

describe('Signature Entity', () => {
  describe('sign()', () => {
    it('should mark PENDING → SIGNED with metadata', () => {
      const sig = makeSig(SignatureStatus.PENDING);
      sig.sign('127.0.0.1', 'jest-agent');
      expect(sig.status).toBe(SignatureStatus.SIGNED);
      expect(sig.signedAt).toBeInstanceOf(Date);
      expect(sig.ipAddress).toBe('127.0.0.1');
      expect(sig.userAgent).toBe('jest-agent');
    });

    it('should set null for optional params', () => {
      const sig = makeSig();
      sig.sign();
      expect(sig.ipAddress).toBeNull();
      expect(sig.userAgent).toBeNull();
    });

    it('should throw if already SIGNED', () => {
      const sig = makeSig(SignatureStatus.SIGNED);
      expect(() => sig.sign()).toThrow(/Cannot sign/);
    });

    it('should throw if REJECTED', () => {
      const sig = makeSig(SignatureStatus.REJECTED);
      expect(() => sig.sign()).toThrow();
    });
  });

  describe('reject()', () => {
    it('should mark PENDING → REJECTED with reason', () => {
      const sig = makeSig(SignatureStatus.PENDING);
      sig.reject('Not authorized');
      expect(sig.status).toBe(SignatureStatus.REJECTED);
      expect(sig.rejectedAt).toBeInstanceOf(Date);
      expect(sig.rejectionReason).toBe('Not authorized');
    });

    it('should throw if already SIGNED', () => {
      const sig = makeSig(SignatureStatus.SIGNED);
      expect(() => sig.reject('reason')).toThrow(/Cannot reject/);
    });

    it('should throw if already REJECTED', () => {
      const sig = makeSig(SignatureStatus.REJECTED);
      expect(() => sig.reject('reason')).toThrow();
    });
  });
});

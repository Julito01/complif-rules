import {
  SignatureRequestStatus,
  isTerminalStatus,
} from '../value-objects/signature-request-status.vo';
import { SignatureStatus } from '../value-objects/signature-status.vo';
import { FacultyCode } from '../value-objects/faculty-code.vo';

describe('Signature Value Objects', () => {
  describe('SignatureRequestStatus', () => {
    it('should define all expected statuses', () => {
      expect(SignatureRequestStatus.CREATED).toBe('CREATED');
      expect(SignatureRequestStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(SignatureRequestStatus.COMPLETED).toBe('COMPLETED');
      expect(SignatureRequestStatus.REJECTED).toBe('REJECTED');
      expect(SignatureRequestStatus.CANCELLED).toBe('CANCELLED');
      expect(SignatureRequestStatus.EXPIRED).toBe('EXPIRED');
    });
  });

  describe('isTerminalStatus()', () => {
    it.each([
      [SignatureRequestStatus.COMPLETED, true],
      [SignatureRequestStatus.REJECTED, true],
      [SignatureRequestStatus.CANCELLED, true],
      [SignatureRequestStatus.EXPIRED, true],
      [SignatureRequestStatus.CREATED, false],
      [SignatureRequestStatus.IN_PROGRESS, false],
    ])('status %s → %s', (status, expected) => {
      expect(isTerminalStatus(status)).toBe(expected);
    });
  });

  describe('SignatureStatus', () => {
    it('should define all expected statuses', () => {
      expect(SignatureStatus.PENDING).toBe('PENDING');
      expect(SignatureStatus.SIGNED).toBe('SIGNED');
      expect(SignatureStatus.REJECTED).toBe('REJECTED');
      expect(SignatureStatus.EXPIRED).toBe('EXPIRED');
    });
  });

  describe('FacultyCode', () => {
    it('should define standard faculty codes', () => {
      expect(FacultyCode.CREATE_WIRE).toBe('CREATE_WIRE');
      expect(FacultyCode.APPROVE_WIRE).toBe('APPROVE_WIRE');
      expect(FacultyCode.REQUEST_LOAN).toBe('REQUEST_LOAN');
      expect(FacultyCode.APPROVE_LOAN).toBe('APPROVE_LOAN');
      expect(FacultyCode.MODIFY_CONTACT_INFO).toBe('MODIFY_CONTACT_INFO');
      expect(FacultyCode.VIEW_STATEMENTS).toBe('VIEW_STATEMENTS');
      expect(FacultyCode.MANAGE_SIGNERS).toBe('MANAGE_SIGNERS');
    });
  });
});

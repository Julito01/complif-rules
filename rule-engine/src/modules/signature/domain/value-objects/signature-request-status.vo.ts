/**
 * Signature Request Status - valid states for a signature request.
 * Per signature-request-lifecycle skill.
 */
export enum SignatureRequestStatus {
  CREATED = 'CREATED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

/**
 * Check if status is a terminal state (no further transitions allowed).
 */
export function isTerminalStatus(status: SignatureRequestStatus): boolean {
  return [
    SignatureRequestStatus.COMPLETED,
    SignatureRequestStatus.REJECTED,
    SignatureRequestStatus.CANCELLED,
    SignatureRequestStatus.EXPIRED,
  ].includes(status);
}

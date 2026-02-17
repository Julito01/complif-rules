import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { InvalidStateException } from '../../../../shared/exceptions';
import { Account } from './account.entity';
import { Faculty } from './faculty.entity';
import { SignatureRule } from './signature-rule.entity';
import { Signature } from './signature.entity';
import {
  SignatureRequestStatus,
  isTerminalStatus,
} from '../value-objects/signature-request-status.vo';
import { SignatureStatus } from '../value-objects/signature-status.vo';
import { RuleDefinition } from '../value-objects/rule-definition.vo';

/**
 * SignatureRequest - AGGREGATE ROOT for signature authorization workflow.
 *
 * This is a runtime instance tracking collected signatures.
 * Per DDD skill: "Signature Request SHOULD be treated as an Aggregate Root"
 *
 * Invariants enforced:
 * - Status transitions are explicit and validated
 * - COMPLETED is a terminal state
 * - Signatures are immutable once request is completed
 */
@Entity('signature_requests')
@Index('IDX_signature_requests_organization', ['idOrganization'])
@Index('IDX_signature_requests_account', ['idAccount'])
@Index('IDX_signature_requests_status', ['status'])
@Index('IDX_signature_requests_org_status', ['idOrganization', 'status'])
@Index('IDX_signature_requests_reference', ['referenceType', 'referenceId'])
export class SignatureRequest extends BaseEntity {
  @Column({ name: 'id_account', type: 'uuid' })
  idAccount: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'id_account' })
  account: Account;

  @Column({ name: 'id_faculty', type: 'uuid' })
  idFaculty: string;

  @ManyToOne(() => Faculty)
  @JoinColumn({ name: 'id_faculty' })
  faculty: Faculty;

  @Column({ name: 'id_rule', type: 'uuid' })
  idRule: string;

  @ManyToOne(() => SignatureRule)
  @JoinColumn({ name: 'id_rule' })
  rule: SignatureRule;

  @Column({ name: 'reference_id', type: 'varchar', nullable: true })
  referenceId: string | null;

  @Column({ name: 'reference_type', type: 'varchar', nullable: true })
  referenceType: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: SignatureRequestStatus,
    default: SignatureRequestStatus.CREATED,
  })
  status: SignatureRequestStatus;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  /**
   * Snapshot of the rule at creation time.
   * Schema changes MUST NOT affect already-created signature requests.
   */
  @Column({ name: 'rule_snapshot', type: 'jsonb' })
  ruleSnapshot: RuleDefinition;

  @OneToMany(() => Signature, (sig) => sig.request, { cascade: true })
  signatures: Signature[];

  // ==================== AGGREGATE METHODS ====================

  /**
   * Transition to IN_PROGRESS when first signature is added.
   */
  markInProgress(): void {
    if (this.status !== SignatureRequestStatus.CREATED) {
      throw new Error(`Cannot mark as in_progress from status ${this.status}`);
    }
    this.status = SignatureRequestStatus.IN_PROGRESS;
  }

  /**
   * Transition to COMPLETED when authorization is satisfied.
   */
  complete(): void {
    if (isTerminalStatus(this.status)) {
      throw new InvalidStateException(
        `Cannot complete a request with terminal status ${this.status}`,
        this.status,
        [SignatureRequestStatus.CREATED, SignatureRequestStatus.IN_PROGRESS],
      );
    }
    this.status = SignatureRequestStatus.COMPLETED;
    this.completedAt = new Date();
  }

  /**
   * Cancel the request.
   */
  cancel(): void {
    if (isTerminalStatus(this.status)) {
      throw new InvalidStateException(
        `Cannot cancel a request with terminal status ${this.status}`,
        this.status,
        [SignatureRequestStatus.CREATED, SignatureRequestStatus.IN_PROGRESS],
      );
    }
    this.status = SignatureRequestStatus.CANCELLED;
  }

  /**
   * Reject the request.
   */
  reject(): void {
    if (isTerminalStatus(this.status)) {
      throw new InvalidStateException(
        `Cannot reject a request with terminal status ${this.status}`,
        this.status,
        [SignatureRequestStatus.CREATED, SignatureRequestStatus.IN_PROGRESS],
      );
    }
    this.status = SignatureRequestStatus.REJECTED;
  }

  /**
   * Expire the request.
   */
  expire(): void {
    if (isTerminalStatus(this.status)) {
      throw new InvalidStateException(
        `Cannot expire a request with terminal status ${this.status}`,
        this.status,
        [SignatureRequestStatus.CREATED, SignatureRequestStatus.IN_PROGRESS],
      );
    }
    this.status = SignatureRequestStatus.EXPIRED;
  }

  /**
   * Check if this request is in a terminal state.
   */
  isTerminal(): boolean {
    return isTerminalStatus(this.status);
  }

  /**
   * Get count of signed signatures per group code.
   */
  getSignatureCountsByGroup(): Map<string, number> {
    const counts = new Map<string, number>();

    if (!this.signatures) {
      return counts;
    }

    for (const sig of this.signatures) {
      if (sig.status === SignatureStatus.SIGNED && sig.group) {
        const groupCode = sig.group.code;
        counts.set(groupCode, (counts.get(groupCode) || 0) + 1);
      }
    }

    return counts;
  }
}

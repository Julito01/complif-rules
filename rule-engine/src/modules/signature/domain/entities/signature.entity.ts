import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { SignatureRequest } from './signature-request.entity';
import { Signer } from './signer.entity';
import { SignerGroup } from './signer-group.entity';
import { SignatureStatus } from '../value-objects/signature-status.vo';

/**
 * Signature entity - an individual signature on a request.
 * Immutable once status is SIGNED or REJECTED.
 */
@Entity('signatures')
@Index('IDX_signatures_organization', ['idOrganization'])
@Index('IDX_signatures_request', ['idRequest'])
@Index('IDX_signatures_signer', ['idSigner'])
@Index('IDX_signatures_request_status', ['idRequest', 'status'])
export class Signature extends BaseEntity {
  @Column({ name: 'id_request', type: 'uuid' })
  idRequest: string;

  @ManyToOne(() => SignatureRequest, (request) => request.signatures)
  @JoinColumn({ name: 'id_request' })
  request: SignatureRequest;

  @Column({ name: 'id_signer', type: 'uuid' })
  idSigner: string;

  @ManyToOne(() => Signer)
  @JoinColumn({ name: 'id_signer' })
  signer: Signer;

  @Column({ name: 'id_group', type: 'uuid' })
  idGroup: string;

  @ManyToOne(() => SignerGroup)
  @JoinColumn({ name: 'id_group' })
  group: SignerGroup;

  @Column({
    type: 'enum',
    enum: SignatureStatus,
    default: SignatureStatus.PENDING,
  })
  status: SignatureStatus;

  @Column({ name: 'signed_at', type: 'timestamp', nullable: true })
  signedAt: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  /**
   * Mark this signature as signed.
   */
  sign(ipAddress?: string, userAgent?: string): void {
    if (this.status !== SignatureStatus.PENDING) {
      throw new Error(`Cannot sign a signature with status ${this.status}`);
    }
    this.status = SignatureStatus.SIGNED;
    this.signedAt = new Date();
    this.ipAddress = ipAddress || null;
    this.userAgent = userAgent || null;
  }

  /**
   * Mark this signature as rejected.
   */
  reject(reason: string): void {
    if (this.status !== SignatureStatus.PENDING) {
      throw new Error(`Cannot reject a signature with status ${this.status}`);
    }
    this.status = SignatureStatus.REJECTED;
    this.rejectedAt = new Date();
    this.rejectionReason = reason;
  }
}

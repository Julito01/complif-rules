import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { SignerGroup } from './signer-group.entity';

/**
 * Signer status enumeration.
 */
export enum SignerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

/**
 * Signer entity - a human or legal representative who can sign.
 */
@Entity('signers')
export class Signer extends BaseEntity {
  @Column({ name: 'id_account', type: 'uuid' })
  idAccount: string;

  @Column({ name: 'external_user_id', type: 'varchar', nullable: true })
  externalUserId: string | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'document_number', type: 'varchar', nullable: true })
  documentNumber: string | null;

  @Column({
    type: 'enum',
    enum: SignerStatus,
    default: SignerStatus.ACTIVE,
  })
  status: SignerStatus;

  @ManyToMany(() => SignerGroup, (group) => group.signers)
  groups: SignerGroup[];
}

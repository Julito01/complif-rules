import { Entity, Column, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { Account } from './account.entity';
import { SignerGroup } from './signer-group.entity';
import { SignatureRule } from './signature-rule.entity';

/**
 * SignatureSchema - configuration defining authorization rules per account.
 * This is a static configuration layer, not runtime state.
 */
@Entity('signature_schemas')
export class SignatureSchema extends BaseEntity {
  @Column({ name: 'id_account', type: 'uuid' })
  idAccount: string;

  @OneToOne(() => Account, (account) => account.signatureSchema)
  @JoinColumn({ name: 'id_account' })
  account: Account;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'effective_from', type: 'timestamp', nullable: true })
  effectiveFrom: Date | null;

  @Column({ name: 'effective_to', type: 'timestamp', nullable: true })
  effectiveTo: Date | null;

  @OneToMany(() => SignerGroup, (group) => group.schema)
  groups: SignerGroup[];

  @OneToMany(() => SignatureRule, (rule) => rule.schema)
  rules: SignatureRule[];
}

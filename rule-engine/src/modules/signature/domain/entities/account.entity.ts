import { Entity, Column, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { SignatureSchema } from './signature-schema.entity';

/**
 * Account entity - owns a signature schema.
 * Represents a corporate account that requires signature authorization.
 */
@Entity('accounts')
export class Account extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'external_id', type: 'varchar', nullable: true })
  externalId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToOne(() => SignatureSchema, (schema) => schema.account)
  signatureSchema: SignatureSchema;
}

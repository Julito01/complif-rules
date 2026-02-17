import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';

/**
 * Transaction - immutable event representing a financial transaction.
 *
 * Transactions are never mutated after creation.
 * They serve as the input facts for rule evaluation.
 */
@Entity('transactions')
@Index('idx_transaction_account_datetime', ['idAccount', 'datetime'])
@Index('idx_transaction_org_datetime', ['idOrganization', 'datetime'])
@Index('idx_transaction_account_type_datetime', ['idAccount', 'type', 'datetime'])
@Index('idx_transaction_org_account_datetime', ['idOrganization', 'idAccount', 'datetime'])
export class Transaction extends BaseEntity {
  @Column({ name: 'id_account', type: 'uuid' })
  idAccount: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ name: 'sub_type', type: 'varchar', length: 50, nullable: true })
  subType: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ name: 'amount_normalized', type: 'numeric', precision: 18, scale: 2, nullable: true })
  amountNormalized: number | null;

  @Column({ name: 'currency_normalized', type: 'varchar', length: 3, default: 'USD' })
  currencyNormalized: string;

  @Column({ type: 'timestamp with time zone' })
  datetime: Date;

  @Column({ type: 'date', nullable: true })
  date: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ name: 'counterparty_id', type: 'varchar', length: 255, nullable: true })
  counterpartyId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  channel: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 8, nullable: true })
  quantity: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  asset: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 8, nullable: true })
  price: number | null;

  @Column({ name: 'is_voided', type: 'boolean', default: false })
  isVoided: boolean;

  @Column({ name: 'is_blocked', type: 'boolean', default: false })
  isBlocked: boolean;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @Column({ name: 'external_code', type: 'varchar', length: 255, nullable: true })
  externalCode: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  origin: string | null;

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo: Record<string, unknown> | null;

  @Column({ name: 'id_transaction_lote', type: 'uuid', nullable: true })
  idTransactionLote: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}

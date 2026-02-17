import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { ComplianceList } from './compliance-list.entity';

/**
 * ComplianceListEntry — a single value within a compliance list.
 *
 * Examples: country code "IR", account UUID, counterparty identifier.
 * Each entry belongs to exactly one ComplianceList.
 * Uniqueness is enforced per (list, value) to prevent duplicates.
 */
@Entity('compliance_list_entries')
@Index('idx_entry_list', ['idList'])
@Index('idx_entry_list_value', ['idList', 'value'], { unique: true })
@Index('idx_entry_org_entity_value', ['idOrganization', 'value'])
export class ComplianceListEntry extends BaseEntity {
  @Column({ name: 'id_list', type: 'uuid' })
  idList: string;

  @Column({ type: 'varchar', length: 255 })
  value: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ManyToOne(() => ComplianceList, (list) => list.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_list' })
  list: ComplianceList;
}

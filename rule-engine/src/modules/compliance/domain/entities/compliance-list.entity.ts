import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { ComplianceListEntry } from './compliance-list-entry.entity';

/**
 * ComplianceList — a managed blacklist or whitelist of entities.
 *
 * Lists are organization-scoped and typed by the kind of entity they screen:
 * countries, accounts, or counterparties.
 *
 * During transaction evaluation, rule conditions can reference list membership
 * to produce deterministic screening decisions.
 */
@Entity('compliance_lists')
@Index('idx_compliance_list_org', ['idOrganization'])
@Index('idx_compliance_list_org_code', ['idOrganization', 'code'], { unique: true })
export class ComplianceList extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20 })
  type: 'BLACKLIST' | 'WHITELIST';

  @Column({ name: 'entity_type', type: 'varchar', length: 30 })
  entityType: 'COUNTRY' | 'ACCOUNT' | 'COUNTERPARTY';

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => ComplianceListEntry, (entry) => entry.list, { cascade: true })
  entries: ComplianceListEntry[];
}

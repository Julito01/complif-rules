import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { FacultyCode } from '../value-objects/faculty-code.vo';

/**
 * Faculty entity - represents a capability that requires authorization.
 * Examples: APPROVE_WIRE, REQUEST_LOAN, etc.
 */
@Entity('faculties')
export class Faculty extends BaseEntity {
  @Column({ type: 'enum', enum: FacultyCode })
  code: FacultyCode;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}

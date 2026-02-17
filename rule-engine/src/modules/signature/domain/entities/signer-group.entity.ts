import { Entity, Column, ManyToOne, ManyToMany, JoinColumn, JoinTable } from 'typeorm';
import { BaseEntity } from '../../../../shared/entities';
import { SignatureSchema } from './signature-schema.entity';
import { Signer } from './signer.entity';

/**
 * SignerGroup - logical grouping of signers (A, B, C, etc.)
 * Used in authorization rules to define required signer combinations.
 */
@Entity('signer_groups')
export class SignerGroup extends BaseEntity {
  @Column({ name: 'id_signature_schema', type: 'uuid' })
  idSignatureSchema: string;

  @ManyToOne(() => SignatureSchema, (schema) => schema.groups)
  @JoinColumn({ name: 'id_signature_schema' })
  schema: SignatureSchema;

  @Column({ type: 'varchar', length: 10 })
  code: string; // 'A', 'B', 'C', etc.

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: 0 })
  priority: number;

  @ManyToMany(() => Signer, (signer) => signer.groups)
  @JoinTable({
    name: 'signer_group_members',
    joinColumn: { name: 'id_group', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'id_signer', referencedColumnName: 'id' },
  })
  signers: Signer[];
}

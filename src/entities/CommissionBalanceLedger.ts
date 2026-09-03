import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';
import { CommissionLedgerEntityType, CommissionLedgerReason } from '../types/enums';

/**
 * Broker/acente bakiye hareket geçmişi (audit log). Her satır, bir bakiye
 * değişimini (delta) ve o andaki sonuç bakiyeyi (balance_after) kaydeder.
 */
@Entity('commission_balance_ledger')
export class CommissionBalanceLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({
    type: 'enum',
    enum: CommissionLedgerEntityType,
  })
  entity_type: CommissionLedgerEntityType;

  @Index()
  @Column({ type: 'uuid' })
  entity_id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  delta: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  balance_after: number;

  @Column({
    type: 'enum',
    enum: CommissionLedgerReason,
  })
  reason: CommissionLedgerReason;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ref_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  ref_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn()
  created_at: Date;
}

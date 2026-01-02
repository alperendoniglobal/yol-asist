import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { AgencyContractAcceptance } from './AgencyContractAcceptance';

/**
 * Sözleşme Versiyonları
 * Acente hizmet sözleşmesinin farklı versiyonlarını saklar.
 * SUPER_ADMIN tarafından yönetilir.
 * Sadece bir versiyon aktif olabilir.
 */
@Entity('contract_versions')
export class ContractVersion {
  // Benzersiz kimlik
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Versiyon numarası (örn: "1.0", "1.1", "2.0")
  @Column({ type: 'varchar', length: 20 })
  version: string;

  // Sözleşme başlığı
  @Column({ type: 'varchar', length: 255 })
  title: string;

  // Sözleşme içeriği (HTML formatında - rich text)
  @Column({ type: 'longtext' })
  content: string;

  // Aktif versiyon mu? (Sadece bir versiyon aktif olabilir)
  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  // Sözleşme özeti (kısa açıklama)
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  // Değişiklik notları (bu versiyonda ne değişti)
  @Column({ type: 'text', nullable: true })
  change_notes: string | null;

  // Oluşturulma tarihi
  @CreateDateColumn()
  created_at: Date;

  // Güncellenme tarihi
  @UpdateDateColumn()
  updated_at: Date;

  // İlişkiler
  // Bu versiyonu kabul eden acenteler
  @OneToMany(() => AgencyContractAcceptance, acceptance => acceptance.contractVersion)
  acceptances: AgencyContractAcceptance[];
}


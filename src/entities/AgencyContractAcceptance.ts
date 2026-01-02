import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Agency } from './Agency';
import { User } from './User';
import { ContractVersion } from './ContractVersion';

/**
 * Acente Sözleşme Onay Kayıtları
 * Acentelerin sözleşmeyi ne zaman, hangi IP'den, hangi cihazdan onayladığını saklar.
 * Hukuki ispat için kritik öneme sahip log tablosu.
 * Bu kayıtlar SİLİNMEMELİ.
 */
@Entity('agency_contract_acceptances')
export class AgencyContractAcceptance {
  // Benzersiz kimlik
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Onaylayan acentenin ID'si
  @Column({ type: 'varchar', length: 36 })
  agency_id: string;

  // Onaylayan kullanıcının ID'si (acente yöneticisi)
  @Column({ type: 'varchar', length: 36 })
  user_id: string;

  // Onaylanan sözleşme versiyonunun ID'si
  @Column({ type: 'varchar', length: 36 })
  contract_version_id: string;

  // Kullanıcının IP adresi (IPv4 veya IPv6)
  @Column({ type: 'varchar', length: 45 })
  ip_address: string;

  // Kullanıcının tarayıcı/cihaz bilgisi
  @Column({ type: 'text' })
  user_agent: string;

  // Checkbox 1: "Sözleşmeyi okudum, anladım ve onaylıyorum"
  @Column({ type: 'boolean', default: false })
  checkbox1_accepted: boolean;

  // Checkbox 2: "Bu hizmetin sigorta ürünü olmadığını kabul ediyorum"
  @Column({ type: 'boolean', default: false })
  checkbox2_accepted: boolean;

  // Sözleşme metninin en sonuna kadar scroll edildi mi?
  @Column({ type: 'boolean', default: false })
  scroll_completed: boolean;

  // Onay tarihi ve saati (timestamp)
  @CreateDateColumn()
  accepted_at: Date;

  // İlişkiler
  // Onaylayan acente
  @ManyToOne(() => Agency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  // Onaylayan kullanıcı
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Onaylanan sözleşme versiyonu
  @ManyToOne(() => ContractVersion, version => version.acceptances, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_version_id' })
  contractVersion: ContractVersion;
}


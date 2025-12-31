import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { DealerApplicationStatus } from '../types/enums';
import { User } from './User';

/**
 * Bayilik Başvurusu Entity
 * Acente olmak isteyen kişilerin başvuruları burada tutulur.
 * Super Admin tarafından onaylandığında otomatik acente oluşturulur.
 */
@Entity('dealer_applications')
export class DealerApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Başvuran kişi bilgileri
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  surname: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  // T.C. Kimlik No veya Vergi Kimlik No
  @Column({ type: 'varchar', length: 20 })
  tc_vkn: string;

  // Şirket adı (opsiyonel - kurumsal başvurular için)
  @Column({ type: 'varchar', length: 255, nullable: true })
  company_name: string;

  // Adres bilgileri
  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  // Referans kodu (mevcut bir bayi tarafından yönlendirilmişse)
  @Column({ type: 'varchar', length: 50, nullable: true })
  referral_code: string;

  // Şifre hash'i (onaylandığında kullanıcı hesabı oluşturmak için)
  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  // Başvuru durumu
  @Column({
    type: 'enum',
    enum: DealerApplicationStatus,
    default: DealerApplicationStatus.PENDING
  })
  status: DealerApplicationStatus;

  // Admin notları (red sebebi veya onay notu)
  @Column({ type: 'text', nullable: true })
  notes: string;

  // İnceleme bilgileri
  @Column({ type: 'timestamp', nullable: true })
  reviewed_at: Date;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}


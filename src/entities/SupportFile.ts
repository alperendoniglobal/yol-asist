import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Sale } from './Sale';
import { User } from './User';

/**
 * Destek Ekibi Hasar Dosyası
 * Çağrı merkezi tarafından oluşturulan hasar dosyaları
 * Bir satışın birden fazla hasar dosyası olabilir
 */
@Entity('support_files')
export class SupportFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Satış ID (hangi satışa ait)
  @Column({ type: 'uuid' })
  sale_id: string;

  // Dosyayı oluşturan kullanıcı (destek ekibi)
  // nullable: true çünkü onDelete: 'SET NULL' kullanılıyor
  // Kullanıcı silindiğinde bu değer NULL olacak
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  // Hasar Dosya Numarası (benzersiz, otomatik oluşturulur)
  @Column({ type: 'varchar', length: 50, unique: true })
  damage_file_number: string;

  // Satış Bilgileri
  @Column({ type: 'varchar', length: 50, nullable: true })
  policy_number: string | null;

  // Hasar Dosya Bilgileri
  @Column({ type: 'varchar', length: 50, nullable: true })
  damage_policy_number: string | null;

  @Column({ type: 'date', nullable: true })
  policy_start_date: Date | null;

  // Sigortalı Bilgileri
  @Column({ type: 'varchar', length: 255 })
  insured_name: string;

  @Column({ type: 'varchar', length: 20 })
  insured_phone: string;

  // Araç Bilgileri
  @Column({ type: 'varchar', length: 20 })
  vehicle_plate: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vehicle_model: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  model_year: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vehicle_brand: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  vehicle_segment: string | null;

  // İşlem Bilgileri
  @Column({ type: 'varchar', length: 255 })
  service_type: string; // Yapılacak işlem (paket kapsamından)

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  service_amount: number | null; // İşlem tutarı

  @Column({ type: 'varchar', length: 255, nullable: true })
  roadside_assistance_coverage: string | null; // Yol Yardım Teyminatı

  @Column({ type: 'varchar', length: 100 })
  city: string; // Çekim işleminin yapılacağı şehir

  @Column({ type: 'varchar', length: 255 })
  staff_name: string; // Personel adı (otomatik: giriş yapan kullanıcı)

  @Column({ type: 'int', nullable: true })
  kilometer: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  heavy_commercial: string | null; // Ağır Ticari (Hayır/Evet)

  @Column({ type: 'text', nullable: true })
  start_address: string | null; // Başlangıç adresi

  @Column({ type: 'text', nullable: true })
  end_address: string | null; // Bitiş adresi

  @Column({ type: 'datetime' })
  request_date_time: Date; // Sigortalı talep tarihi ve saat

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // ===== İLİŞKİLER =====
  
  // Hangi satışa ait
  @ManyToOne(() => Sale, sale => sale.supportFiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  // Dosyayı oluşturan kullanıcı
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;
}



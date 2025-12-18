import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Package } from './Package';

/**
 * Paket Kapsamı / Teminat
 * Her paketteki hizmet/teminat detayları
 * Örn: "2 Çekici Hizmeti Kaza (12,500.00 TL'ye Kadar)"
 */
@Entity('package_covers')
export class PackageCover {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  package_id: string;

  // Teminat başlığı (örn: "Çekici Hizmeti Kaza", "Lastik Patlaması")
  @Column({ type: 'varchar', length: 255 })
  title: string;

  // Teminat açıklaması / detayı
  @Column({ type: 'text', nullable: true })
  description: string;

  // Kullanım adedi (örn: 2 = 2 kez kullanılabilir)
  @Column({ type: 'int', default: 1 })
  usage_count: number;

  // Limit tutarı TL (örn: 12500 = 12,500 TL'ye kadar)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  limit_amount: number;

  // Sıralama
  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // ===== İLİŞKİLER =====
  @ManyToOne(() => Package, pkg => pkg.covers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'package_id' })
  package: Package;
}

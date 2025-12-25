import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

/**
 * Landing Page İstatistikler
 * SUPER_ADMIN tarafından yönetilir
 */
@Entity('landing_page_stats')
export class LandingPageStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Etiket
  @Column({ type: 'varchar', length: 255 })
  label: string;

  // Değer (sayı)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  // Ek (%, +, K, M, vb.)
  @Column({ type: 'varchar', length: 10, nullable: true })
  suffix: string;

  // İkon adı (lucide-react)
  @Column({ type: 'varchar', length: 100 })
  icon_name: string;

  // Sıralama (order)
  @Column({ type: 'int', default: 0 })
  order: number;

  // Aktif/Pasif
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}


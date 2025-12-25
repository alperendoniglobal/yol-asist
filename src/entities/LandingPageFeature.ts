import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

/**
 * Landing Page Features Bölümü
 * SUPER_ADMIN tarafından yönetilir
 */
@Entity('landing_page_features')
export class LandingPageFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // İkon adı (lucide-react)
  @Column({ type: 'varchar', length: 100 })
  icon_name: string;

  // Başlık
  @Column({ type: 'varchar', length: 255 })
  title: string;

  // Açıklama
  @Column({ type: 'text' })
  description: string;

  // Gradient renk sınıfları (Tailwind CSS)
  @Column({ type: 'varchar', length: 255, nullable: true })
  gradient: string;

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


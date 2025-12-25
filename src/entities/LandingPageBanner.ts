import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

/**
 * Landing Page Banner Slider'ları
 * SUPER_ADMIN tarafından yönetilir
 */
@Entity('landing_page_banners')
export class LandingPageBanner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Banner görsel dosya yolu
  @Column({ type: 'varchar', length: 500 })
  image_path: string;

  // Badge metni
  @Column({ type: 'varchar', length: 255, nullable: true })
  badge: string;

  // Sol taraf içeriği - JSON formatında
  @Column({ type: 'json', nullable: true })
  left_content: {
    title: string;
    subtitle: string;
    description: string;
    feature: string;
    feature_icon: string; // lucide-react icon adı
  };

  // Sağ taraf içeriği - JSON formatında
  @Column({ type: 'json', nullable: true })
  right_content: {
    title: string;
    subtitle: string;
    description: string;
  };

  // Banner'a özel istatistikler - JSON formatında
  @Column({ type: 'json', nullable: true })
  banner_stats: Array<{
    label: string;
    value: number;
    suffix?: string;
    icon: string; // lucide-react icon adı
  }>;

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


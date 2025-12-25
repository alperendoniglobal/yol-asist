import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

/**
 * Sayfa İçerikleri
 * Hakkımızda, Mesafeli Satış Sözleşmesi, Gizlilik Politikası, KVKK Aydınlatma Metni, Teslimat ve İade
 * SUPER_ADMIN tarafından yönetilir
 */
@Entity('page_contents')
export class PageContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // URL slug (about, distance-sales-contract, privacy-policy, kvkk, delivery-return)
  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  // Sayfa başlığı
  @Column({ type: 'varchar', length: 255 })
  title: string;

  // HTML içerik (rich text)
  @Column({ type: 'longtext' })
  content: string;

  // SEO - Meta title
  @Column({ type: 'varchar', length: 255, nullable: true })
  meta_title: string;

  // SEO - Meta description
  @Column({ type: 'text', nullable: true })
  meta_description: string;

  // SEO - Meta keywords
  @Column({ type: 'text', nullable: true })
  meta_keywords: string;

  // Aktif/Pasif
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}


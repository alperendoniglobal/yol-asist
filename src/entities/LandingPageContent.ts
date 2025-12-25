import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

/**
 * Landing Page Genel Ayarları
 * Singleton pattern - Tek bir kayıt olacak
 * SUPER_ADMIN tarafından yönetilir
 */
@Entity('landing_page_content')
export class LandingPageContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Destek telefon numarası
  @Column({ type: 'varchar', length: 50, default: '+90 (850) 304 54 40' })
  support_phone: string;

  // Destek e-posta
  @Column({ type: 'varchar', length: 255, nullable: true })
  support_email: string;

  // Şirket adı
  @Column({ type: 'varchar', length: 255, default: 'Çözüm Asistan' })
  company_name: string;

  // Şirket adresi
  @Column({ type: 'text', nullable: true })
  company_address: string;

  // SEO - Meta title
  @Column({ type: 'varchar', length: 255, nullable: true })
  meta_title: string;

  // SEO - Meta description
  @Column({ type: 'text', nullable: true })
  meta_description: string;

  // SEO - Meta keywords
  @Column({ type: 'text', nullable: true })
  meta_keywords: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}


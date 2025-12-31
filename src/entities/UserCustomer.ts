import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { Sale } from './Sale';
import { Vehicle } from './Vehicle';

/**
 * UserCustomer Entity
 * Bireysel kullanıcılar için - kendileri kayıt olup, giriş yapıp paket satın alabilirler
 * Mevcut Customer tablosundan bağımsız - acente müşterilerinden ayrı tutulur
 */
@Entity('user_customers')
export class UserCustomer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // T.C. Kimlik No - benzersiz olmalı
  @Column({ type: 'varchar', length: 11, unique: true })
  tc_vkn: string;

  // Ad
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Soyad
  @Column({ type: 'varchar', length: 255 })
  surname: string;

  // Email - benzersiz olmalı ve giriş için kullanılacak
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  // Telefon
  @Column({ type: 'varchar', length: 50 })
  phone: string;

  // Şifre - hashlenmiş olarak saklanacak
  @Column({ type: 'varchar', length: 255 })
  password: string;

  // İl (opsiyonel)
  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  // İlçe (opsiyonel)
  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string;

  // Açık adres (opsiyonel)
  @Column({ type: 'text', nullable: true })
  address: string;

  // Hesap aktif mi?
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations - UserCustomer'ın satışları ve araçları
  @OneToMany(() => Sale, sale => sale.user_customer)
  sales: Sale[];

  @OneToMany(() => Vehicle, vehicle => vehicle.user_customer)
  vehicles: Vehicle[];
}


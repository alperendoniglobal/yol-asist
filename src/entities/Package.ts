import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { EntityStatus } from '../types/enums';
import { PackageCover } from './PackageCover';
import { Sale } from './Sale';

/**
 * Sigorta/Yol Asistan Paketi
 * Her paket sabit fiyatlı ve belirli bir araç türü için geçerlidir.
 * Komisyon oranı acenteye göre belirlenir, pakete göre değil.
 */
@Entity('packages')
export class Package {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Paket adı (örn: "Hususi Paket (T)", "Plus Hususi (T)")
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Paket açıklaması
  @Column({ type: 'text', nullable: true })
  description: string;

  // Araç türü (örn: "Otomobil", "Motosiklet", "Minibüs", "Kamyonet", "Taksi", "Kamyon", "Çekici")
  @Column({ type: 'varchar', length: 100 })
  vehicle_type: string;

  // Sabit paket fiyatı (TL)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  // Maksimum araç yaşı (örn: 40 = 40 yaşına kadar araçlar için geçerli)
  @Column({ type: 'int', default: 40 })
  max_vehicle_age: number;

  // Paket durumu (aktif/pasif)
  @Column({
    type: 'enum',
    enum: EntityStatus,
    default: EntityStatus.ACTIVE
  })
  status: EntityStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // ===== İLİŞKİLER =====
  
  // Paket kapsamları (teminatlar)
  @OneToMany(() => PackageCover, cover => cover.package, { cascade: true })
  covers: PackageCover[];

  // Bu paketle yapılan satışlar
  @OneToMany(() => Sale, sale => sale.package)
  sales: Sale[];
}

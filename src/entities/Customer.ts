import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { Agency } from './Agency';
import { Branch } from './Branch';
import { User } from './User';
import { Vehicle } from './Vehicle';
import { Sale } from './Sale';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Sistem kayıtları için nullable (Super Admin oluşturduğunda null olabilir)
  @Column({ type: 'uuid', nullable: true })
  agency_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string;

  // Kurumsal mı Bireysel mi?
  @Column({ type: 'boolean', default: false, comment: 'Kurumsal müşteri mi?' })
  is_corporate: boolean;

  // TC Kimlik No (Bireysel) veya Vergi Kimlik No (Kurumsal)
  @Column({ type: 'varchar', length: 11 })
  tc_vkn: string;

  // Bireysel için: Ad | Kurumsal için: Ünvan/Firma Adı
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Bireysel için: Soyad | Kurumsal için boş kalabilir
  @Column({ type: 'varchar', length: 255, nullable: true })
  surname: string;

  // Kurumsal için: Vergi Dairesi
  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Vergi Dairesi (Kurumsal için)' })
  tax_office: string;

  // Doğum Tarihi (Bireysel için önemli, Kurumsal için opsiyonel)
  @Column({ type: 'date', nullable: true, comment: 'Doğum Tarihi' })
  birth_date: Date;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  // İl
  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'İl' })
  city: string;

  // İlçe
  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'İlçe' })
  district: string;

  // Detaylı adres
  @Column({ type: 'text', nullable: true })
  address: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Agency, agency => agency.customers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  @ManyToOne(() => Branch, branch => branch.customers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => User, user => user.customers, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User;

  @OneToMany(() => Vehicle, vehicle => vehicle.customer)
  vehicles: Vehicle[];

  @OneToMany(() => Sale, sale => sale.customer)
  sales: Sale[];
}

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
import { Customer } from './Customer';
import { Vehicle } from './Vehicle';
import { Agency } from './Agency';
import { Branch } from './Branch';
import { User } from './User';
import { Package } from './Package';
import { Payment } from './Payment';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid' })
  vehicle_id: string;

  // Sistem kayıtları için nullable (Super Admin oluşturduğunda null olabilir)
  @Column({ type: 'uuid', nullable: true })
  agency_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string;

  @Column({ type: 'uuid' })
  package_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  commission: number;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date' })
  end_date: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  policy_number: string;

  // ===== İADE BİLGİLERİ =====
  // İade yapıldı mı? (varsayılan: false)
  @Column({ type: 'boolean', default: false })
  is_refunded: boolean;

  // İade tarihi (iade yapıldığında set edilir)
  @Column({ type: 'timestamp', nullable: true })
  refunded_at: Date | null;

  // İade tutarı (TL) - KDV hariç kalan günlerin ücreti
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  refund_amount: number | null;

  // İade sebebi
  @Column({ type: 'text', nullable: true })
  refund_reason: string | null;

  // İade işlemini yapan kullanıcı
  @Column({ type: 'uuid', nullable: true })
  refunded_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Customer, customer => customer.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Vehicle, vehicle => vehicle.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @ManyToOne(() => Agency, agency => agency.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  @ManyToOne(() => Branch, branch => branch.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => User, user => user.sales, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Package, pkg => pkg.sales, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'package_id' })
  package: Package;

  @OneToMany(() => Payment, payment => payment.sale)
  payments: Payment[];
}

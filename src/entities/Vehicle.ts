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
import { UsageType } from '../types/enums';
import { Customer } from './Customer';
import { Agency } from './Agency';
import { Branch } from './Branch';
import { Sale } from './Sale';
import { CarBrand } from './CarBrand';
import { CarModel } from './CarModel';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  // Sistem kayıtları için nullable (Super Admin oluşturduğunda null olabilir)
  @Column({ type: 'uuid', nullable: true })
  agency_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  // Yabancı plaka mı?
  @Column({ type: 'boolean', default: false, comment: 'Yabancı plaka mı?' })
  is_foreign_plate: boolean;

  @Column({ type: 'varchar', length: 20, unique: true })
  plate: string;

  // Ruhsat Seri ve No - Trafik tescil belgesi bilgileri
  @Column({ type: 'varchar', length: 10, nullable: true, comment: 'Ruhsat Seri (örn: AA, AB, AC)' })
  registration_serial: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: 'Ruhsat No' })
  registration_number: string | null;

  @Column({ type: 'int', nullable: true })
  brand_id: number | null;

  @Column({ type: 'int', nullable: true })
  model_id: number | null;

  @Column({ type: 'int' })
  model_year: number;

  @Column({
    type: 'enum',
    enum: UsageType,
    default: UsageType.PRIVATE
  })
  usage_type: UsageType;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Customer, customer => customer.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Agency, agency => agency.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  @ManyToOne(() => Branch, branch => branch.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @OneToMany(() => Sale, sale => sale.vehicle)
  sales: Sale[];

  @ManyToOne(() => CarBrand, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: CarBrand | null;

  @ManyToOne(() => CarModel, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'model_id' })
  model: CarModel | null;
}

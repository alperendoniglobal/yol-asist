import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { CarBrand } from './CarBrand';

@Entity('cars_models')
export class CarModel {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int' })
  brand_id: number;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  value: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => CarBrand, brand => brand.models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: CarBrand;
}


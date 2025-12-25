import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { MotorBrand } from './MotorBrand';

/**
 * Motor Modelleri
 * Motosiklet modellerini saklar
 */
@Entity('motor_models')
export class MotorModel {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int' })
  brand_id: number;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => MotorBrand, brand => brand.models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: MotorBrand;
}


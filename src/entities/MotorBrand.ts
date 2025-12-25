import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { MotorModel } from './MotorModel';

/**
 * Motor Markaları
 * Motosiklet markalarını saklar
 */
@Entity('motor_brands')
export class MotorBrand {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => MotorModel, model => model.brand, { cascade: true })
  models: MotorModel[];
}


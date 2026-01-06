import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index
} from 'typeorm';
import { User } from './User';
import { Agency } from './Agency';

/**
 * UserAgency Junction Table
 * SUPER_AGENCY_ADMIN rolündeki kullanıcıların yönettiği brokerları tutar
 * Bir kullanıcı birden fazla broker yönetebilir
 */
@Entity('user_agencies')
@Index(['user_id', 'agency_id'], { unique: true }) // Aynı kullanıcı-agenet kombinasyonu tekrar edemez
export class UserAgency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  agency_id: string;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => User, user => user.managedAgencies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Agency, agency => agency.managedByUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;
}


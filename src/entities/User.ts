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
import { UserRole, EntityStatus } from '../types/enums';
import { Agency } from './Agency';
import { Branch } from './Branch';
import { Customer } from './Customer';
import { Sale } from './Sale';
import { SupportTicket } from './SupportTicket';
import { SupportMessage } from './SupportMessage';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  agency_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  surname: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.BRANCH_USER
  })
  role: UserRole;

  @Column({ type: 'json', nullable: true })
  permissions: Record<string, any>;

  @Column({
    type: 'enum',
    enum: EntityStatus,
    default: EntityStatus.ACTIVE
  })
  status: EntityStatus;

  // Soft delete icin - kullanici silindiginde true olur, 
  // boylece gecmis veriler korunur
  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  // Silinme tarihi - soft delete yapildiginda set edilir
  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Agency, agency => agency.users, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  @ManyToOne(() => Branch, branch => branch.users, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @OneToMany(() => Customer, customer => customer.created_by_user)
  customers: Customer[];

  @OneToMany(() => Sale, sale => sale.user)
  sales: Sale[];

  @OneToMany(() => SupportTicket, ticket => ticket.user)
  support_tickets: SupportTicket[];

  @OneToMany(() => SupportMessage, message => message.sender)
  support_messages: SupportMessage[];
}

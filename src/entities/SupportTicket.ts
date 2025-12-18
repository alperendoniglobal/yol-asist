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
import { TicketStatus } from '../types/enums';
import { Agency } from './Agency';
import { Branch } from './Branch';
import { User } from './User';
import { SupportMessage } from './SupportMessage';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  agency_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN
  })
  status: TicketStatus;

  @Column({ type: 'varchar', length: 50, default: 'LOW' })
  priority: string;

  @Column({ type: 'timestamp', nullable: true })
  resolved_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Agency, agency => agency.support_tickets, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  @ManyToOne(() => Branch, branch => branch.support_tickets, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => User, user => user.support_tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => SupportMessage, message => message.ticket)
  messages: SupportMessage[];
}

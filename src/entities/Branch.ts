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
import { EntityStatus } from '../types/enums';
import { Agency } from './Agency';
import { User } from './User';
import { Customer } from './Customer';
import { Vehicle } from './Vehicle';
import { Sale } from './Sale';
import { SupportTicket } from './SupportTicket';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  agency_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: EntityStatus,
    default: EntityStatus.ACTIVE
  })
  status: EntityStatus;

  // Şube komisyon oranı (%) - Her şubenin kendi komisyon oranı zorunludur
  // Acente kendi komisyon oranından fazlasını şubeye veremez
  // Örn: 25.00 = %25 komisyon
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  commission_rate: number;

  // Şube bakiyesi (TL) - Şubenin biriken komisyon bakiyesi
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number;

  // Hesap adı - Banka hesap adı
  @Column({ type: 'varchar', length: 255, nullable: true })
  account_name: string | null;

  // IBAN - Uluslararası Banka Hesap Numarası (max 34 karakter)
  @Column({ type: 'varchar', length: 34, nullable: true })
  iban: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Agency, agency => agency.branches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agency_id' })
  agency: Agency;

  @OneToMany(() => User, user => user.branch)
  users: User[];

  @OneToMany(() => Customer, customer => customer.branch)
  customers: Customer[];

  @OneToMany(() => Vehicle, vehicle => vehicle.branch)
  vehicles: Vehicle[];

  @OneToMany(() => Sale, sale => sale.branch)
  sales: Sale[];

  @OneToMany(() => SupportTicket, ticket => ticket.branch)
  support_tickets: SupportTicket[];
}

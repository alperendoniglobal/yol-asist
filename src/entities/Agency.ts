import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { EntityStatus } from '../types/enums';
import { Branch } from './Branch';
import { User } from './User';
import { Customer } from './Customer';
import { Vehicle } from './Vehicle';
import { Sale } from './Sale';
import { Payment } from './Payment';
import { CommissionRequest } from './CommissionRequest';
import { SupportTicket } from './SupportTicket';

/**
 * Acente
 * Her acentenin kendine özel komisyon oranı vardır.
 * Süper admin tarafından belirlenir.
 */
@Entity('agencies')
export class Agency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Acente adı
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Vergi numarası
  @Column({ type: 'varchar', length: 20, nullable: true })
  tax_number: string;

  // Adres
  @Column({ type: 'text', nullable: true })
  address: string;

  // Telefon
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  // E-posta
  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string;

  // Komisyon oranı (%) - Bu acentenin satışlardan alacağı komisyon
  // Örn: 25.00 = %25 komisyon
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 20 })
  commission_rate: number;

  // Acente durumu
  @Column({
    type: 'enum',
    enum: EntityStatus,
    default: EntityStatus.ACTIVE
  })
  status: EntityStatus;

  // Bakiye (TL) - Acentenin biriken komisyon bakiyesi
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number;

  // Logo - Base64 formatında kaydedilir (LONGTEXT - 4GB'a kadar)
  @Column({ type: 'longtext', nullable: true })
  logo: string | null;

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
  @OneToMany(() => Branch, branch => branch.agency)
  branches: Branch[];

  @OneToMany(() => User, user => user.agency)
  users: User[];

  @OneToMany(() => Customer, customer => customer.agency)
  customers: Customer[];

  @OneToMany(() => Vehicle, vehicle => vehicle.agency)
  vehicles: Vehicle[];

  @OneToMany(() => Sale, sale => sale.agency)
  sales: Sale[];

  @OneToMany(() => Payment, payment => payment.agency)
  payments: Payment[];

  @OneToMany(() => CommissionRequest, request => request.agency)
  commission_requests: CommissionRequest[];

  @OneToMany(() => SupportTicket, ticket => ticket.agency)
  support_tickets: SupportTicket[];
}

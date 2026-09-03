export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SUPER_AGENCY_ADMIN = 'SUPER_AGENCY_ADMIN', // Süper Broker Yöneticisi - Birden fazla broker yönetebilir, yeni broker oluşturabilir
  AGENCY_ADMIN = 'AGENCY_ADMIN',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
  BRANCH_USER = 'BRANCH_USER',
  SUPPORT = 'SUPPORT', // Destek ekibi - Sadece SUPER_ADMIN oluşturabilir
  USER = 'USER' // Son kullanıcı - Public satın alma yapan kullanıcılar
}

// Bayilik başvuru durumu
export enum DealerApplicationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum EntityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED'
}

export enum UsageType {
  PRIVATE = 'PRIVATE',
  COMMERCIAL = 'COMMERCIAL',
  TAXI = 'TAXI'
}

export enum PaymentType {
  PAYTR = 'PAYTR',
  BALANCE = 'BALANCE'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum CommissionRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID'
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

// commission_balance_ledger tablosu için: bakiye hareketinin hangi taraf (broker/acente) için olduğu
export enum CommissionLedgerEntityType {
  AGENCY = 'agency',
  BRANCH = 'branch'
}

// commission_balance_ledger tablosu için: bakiye hareketinin sebebi
export enum CommissionLedgerReason {
  SALE_CREDIT = 'SALE_CREDIT',
  COMMISSION_PAID = 'COMMISSION_PAID',
  BALANCE_SALE = 'BALANCE_SALE',
  REFUND = 'REFUND',
  TRANSFER = 'TRANSFER',
  ADJUSTMENT = 'ADJUSTMENT'
}

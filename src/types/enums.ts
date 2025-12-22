export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  AGENCY_ADMIN = 'AGENCY_ADMIN',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
  BRANCH_USER = 'BRANCH_USER',
  SUPPORT = 'SUPPORT' // Destek ekibi - Sadece SUPER_ADMIN oluşturabilir
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
  IYZICO = 'IYZICO',
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

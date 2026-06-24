import { Repository, SelectQueryBuilder } from 'typeorm';
import { Sale } from '../entities/Sale';
import { PaymentStatus, PaymentType } from '../types/enums';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';

export interface CommissionLegacyWarning {
  hasLegacySales: boolean;
  shouldShow: boolean;
  mismatchedSaleCount: number;
  totalSales: number;
  storedTotal: number;
  displayTotal: number;
  difference: number;
  entityName: string;
  commissionRate?: number;
  visibleUntil: string;
  title: string;
  message: string;
}

export type CommissionDisplayScope = 'branch' | 'agency' | 'total';

/** Bilgilendirme bandı bu tarihe kadar gösterilir (dahil). */
export const COMMISSION_LEGACY_NOTICE_VISIBLE_UNTIL = '2026-07-01T23:59:59.999Z';

export function buildLegacyWarning(
  metrics: {
    mismatchedSaleCount: number;
  },
  context: {
    entityName: string;
    scope: CommissionDisplayScope;
  }
): CommissionLegacyWarning {
  const { mismatchedSaleCount } = metrics;
  const hasLegacySales = mismatchedSaleCount > 0;
  const visibleUntil = COMMISSION_LEGACY_NOTICE_VISIBLE_UNTIL;
  const shouldShow = hasLegacySales && Date.now() <= new Date(visibleUntil).getTime();
  const visibleUntilLabel = new Date(visibleUntil).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const title = 'Bilgilendirme';
  const message = hasLegacySales
    ? `${context.entityName}: Satışlarınızın büyük çoğunluğu standart komisyon kaydıyla işlenmiştir. ` +
      `Yalnızca ilk dönemdeki ${mismatchedSaleCount} satışta kayıt yöntemi farklılığı bulunmaktadır; ` +
      `bu durum kazanılan, ödenen veya ödenecek tutarlarınızı değiştirmez. ` +
      `Bu not ${visibleUntilLabel} tarihine kadar gösterilir.`
    : '';

  return {
    hasLegacySales,
    shouldShow,
    mismatchedSaleCount,
    totalSales: 0,
    storedTotal: 0,
    displayTotal: 0,
    difference: 0,
    entityName: context.entityName,
    visibleUntil,
    title,
    message,
  };
}

const BALANCE_PAYMENT_EXISTS = `EXISTS (
  SELECT 1 FROM payments p
  WHERE p.sale_id = sale.id
    AND p.type = :balanceType
    AND p.status = :completedStatus
)`;

/** Yalnızca ilk dönemdeki az sayıdaki farklı kayıt (çoğunlukla KDV hariç kayıtlardan ayrılan satışlar). */
const BRANCH_EARLY_ANOMALY = `(
  ABS(COALESCE(sale.branch_commission, 0) - ROUND(sale.price * branch.commission_rate / 100, 2)) < 0.02
  AND ABS(COALESCE(sale.branch_commission, 0) - ROUND((sale.price / 1.20) * branch.commission_rate / 100, 2)) >= 0.02
)`;

const AGENCY_EARLY_ANOMALY = `(
  sale.branch_id IS NOT NULL AND ABS(
    COALESCE(sale.agency_commission, 0) - ROUND(sale.price * (agency.commission_rate - branch.commission_rate) / 100, 2)
  ) < 0.02 AND ABS(
    COALESCE(sale.agency_commission, 0) - ROUND((sale.price / 1.20) * (agency.commission_rate - branch.commission_rate) / 100, 2)
  ) >= 0.02
) OR (
  sale.branch_id IS NULL AND ABS(
    COALESCE(sale.agency_commission, sale.commission, 0) - ROUND(sale.price * agency.commission_rate / 100, 2)
  ) < 0.02 AND ABS(
    COALESCE(sale.agency_commission, sale.commission, 0) - ROUND((sale.price / 1.20) * agency.commission_rate / 100, 2)
  ) >= 0.02
)`;

function parseRow(raw: {
  displayTotal?: string;
  storedTotal?: string;
  mismatchCount?: string;
} | undefined) {
  const displayTotal = parseFloat(raw?.displayTotal || '0') || 0;
  const storedTotal = parseFloat(raw?.storedTotal || '0') || 0;
  const mismatchedSaleCount = parseInt(raw?.mismatchCount || '0', 10) || 0;
  const difference = Math.round((displayTotal - storedTotal) * 100) / 100;

  return {
    displayTotal,
    storedTotal,
    mismatchedSaleCount,
    difference,
  };
}

function applySaleTenantFilter(
  qb: SelectQueryBuilder<Sale>,
  filter?: Record<string, unknown>
) {
  if (filter && Object.keys(filter).length > 0) {
    applyTenantFilter(qb, filter, 'sale', 'user_id');
  }
}

/** KDV dahil satış fiyatı üzerinden komisyon (bakiye ile ödemede 0). */
export async function getCommissionDisplayMetrics(
  saleRepository: Repository<Sale>,
  filter: Record<string, unknown> | undefined,
  scope: CommissionDisplayScope
): Promise<{
  displayTotal: number;
  storedTotal: number;
  mismatchedSaleCount: number;
  difference: number;
}> {
  const balanceParams = {
    balanceType: PaymentType.BALANCE,
    completedStatus: PaymentStatus.COMPLETED,
  };

  if (scope === 'branch') {
    const qb = saleRepository
      .createQueryBuilder('sale')
      .innerJoin('sale.branch', 'branch')
      .select(
        `COALESCE(SUM(
          CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
          ELSE ROUND(sale.price * branch.commission_rate / 100, 2)
          END
        ), 0)`,
        'displayTotal'
      )
      .addSelect('COALESCE(SUM(COALESCE(sale.branch_commission, 0)), 0)', 'storedTotal')
      .addSelect(
        `COALESCE(SUM(
          CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
          WHEN ${BRANCH_EARLY_ANOMALY}
          THEN 1 ELSE 0 END
        ), 0)`,
        'mismatchCount'
      )
      .where('sale.branch_id IS NOT NULL')
      .setParameters(balanceParams);
    applySaleTenantFilter(qb, filter);
    return parseRow(await qb.getRawOne());
  }

  if (scope === 'agency') {
    const qb = saleRepository
      .createQueryBuilder('sale')
      .innerJoin('sale.agency', 'agency')
      .leftJoin('sale.branch', 'branch')
      .select(
        `COALESCE(SUM(
          CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
          WHEN sale.branch_id IS NOT NULL
            THEN ROUND(sale.price * (agency.commission_rate - branch.commission_rate) / 100, 2)
          ELSE ROUND(sale.price * agency.commission_rate / 100, 2)
          END
        ), 0)`,
        'displayTotal'
      )
      .addSelect(
        'COALESCE(SUM(COALESCE(sale.agency_commission, sale.commission, 0)), 0)',
        'storedTotal'
      )
      .addSelect(
        `COALESCE(SUM(
          CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
          WHEN ${AGENCY_EARLY_ANOMALY}
          THEN 1 ELSE 0 END
        ), 0)`,
        'mismatchCount'
      )
      .where('sale.agency_id IS NOT NULL')
      .setParameters(balanceParams);
    applySaleTenantFilter(qb, filter);
    return parseRow(await qb.getRawOne());
  }

  const qb = saleRepository
    .createQueryBuilder('sale')
    .innerJoin('sale.agency', 'agency')
    .select(
      `COALESCE(SUM(
        CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
        ELSE ROUND(sale.price * agency.commission_rate / 100, 2)
        END
      ), 0)`,
      'displayTotal'
    )
    .addSelect('COALESCE(SUM(COALESCE(sale.commission, 0)), 0)', 'storedTotal')
    .addSelect(
      `COALESCE(SUM(
        CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
        WHEN ABS(COALESCE(sale.commission, 0) - ROUND(sale.price * agency.commission_rate / 100, 2)) < 0.02
          AND ABS(COALESCE(sale.commission, 0) - ROUND((sale.price / 1.20) * agency.commission_rate / 100, 2)) >= 0.02
        THEN 1 ELSE 0 END
      ), 0)`,
      'mismatchCount'
    )
    .setParameters(balanceParams);
  applySaleTenantFilter(qb, filter);
  return parseRow(await qb.getRawOne());
}

/** Şube veya acente satırı için KDV dahil kazanılan komisyon. */
export async function getBranchRowDisplayEarned(
  saleRepository: Repository<Sale>,
  branchId: string
): Promise<{ displayTotal: number; mismatchCount: number }> {
  const raw = await saleRepository
    .createQueryBuilder('sale')
    .innerJoin('sale.branch', 'branch')
    .select(
      `COALESCE(SUM(
        CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
        ELSE ROUND(sale.price * branch.commission_rate / 100, 2)
        END
      ), 0)`,
      'displayTotal'
    )
    .addSelect(
      `COALESCE(SUM(
        CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
        WHEN ${BRANCH_EARLY_ANOMALY}
        THEN 1 ELSE 0 END
      ), 0)`,
      'mismatchCount'
    )
    .where('sale.branch_id = :branchId', { branchId })
    .setParameters({
      balanceType: PaymentType.BALANCE,
      completedStatus: PaymentStatus.COMPLETED,
    })
    .getRawOne<{ displayTotal: string; mismatchCount: string }>();

  return {
    displayTotal: parseFloat(raw?.displayTotal || '0') || 0,
    mismatchCount: parseInt(raw?.mismatchCount || '0', 10) || 0,
  };
}

export async function getAgencyRowDisplayEarned(
  saleRepository: Repository<Sale>,
  agencyId: string
): Promise<{ displayTotal: number; mismatchCount: number }> {
  const raw = await saleRepository
    .createQueryBuilder('sale')
    .innerJoin('sale.agency', 'agency')
    .leftJoin('sale.branch', 'branch')
    .select(
      `COALESCE(SUM(
        CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
        WHEN sale.branch_id IS NOT NULL
          THEN ROUND(sale.price * (agency.commission_rate - branch.commission_rate) / 100, 2)
        ELSE ROUND(sale.price * agency.commission_rate / 100, 2)
        END
      ), 0)`,
      'displayTotal'
    )
    .addSelect(
      `COALESCE(SUM(
        CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
        WHEN ${AGENCY_EARLY_ANOMALY}
        THEN 1 ELSE 0 END
      ), 0)`,
      'mismatchCount'
    )
    .where('sale.agency_id = :agencyId', { agencyId })
    .setParameters({
      balanceType: PaymentType.BALANCE,
      completedStatus: PaymentStatus.COMPLETED,
    })
    .getRawOne<{ displayTotal: string; mismatchCount: string }>();

  return {
    displayTotal: parseFloat(raw?.displayTotal || '0') || 0,
    mismatchCount: parseInt(raw?.mismatchCount || '0', 10) || 0,
  };
}

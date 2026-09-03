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

/**
 * Kayıtlı komisyon (branch_commission/agency_commission/commission), satış anındaki fiyat VE
 * satış anındaki komisyon oranı ile hesaplanıp saklanmıştır — oranlar zaman içinde değiştiği için
 * (satışta kilitlenir), TABLODAKİ ŞİMDİKİ ORANLA yeniden hesaplamak YANLIŞ sonuç üretir.
 * Bu yüzden "kazanılan komisyon" için tek doğru kaynak, satırın kendi kayıtlı değeridir.
 * Buradaki fonksiyonlar artık yeniden hesaplama YAPMAZ; sadece kayıtlı toplamı döner ve
 * (varsa) hâlâ eski/KDV-dahil formülle hesaplanmış kalıntı kayıtları "mismatch" olarak işaretler
 * — bu sayaç sıfır olmalıdır; sıfır değilse Bölüm "geçmiş satış düzeltmesi" tekrar çalıştırılmalıdır.
 */
const BRANCH_LEGACY_VAT_INCLUSIVE = `(
  ABS(COALESCE(sale.branch_commission, 0) - ROUND(sale.price * branch.commission_rate / 100, 2)) < 0.02
  AND ABS(COALESCE(sale.branch_commission, 0) - ROUND((sale.price / 1.20) * branch.commission_rate / 100, 2)) >= 0.02
)`;

const AGENCY_LEGACY_VAT_INCLUSIVE = `(
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

/** Kayıtlı komisyon toplamı (bakiye ile ödemede 0 sayılır — komisyon kesilmez). */
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
          ELSE COALESCE(sale.branch_commission, 0)
          END
        ), 0)`,
        'displayTotal'
      )
      .addSelect('COALESCE(SUM(COALESCE(sale.branch_commission, 0)), 0)', 'storedTotal')
      .addSelect(
        `COALESCE(SUM(
          CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
          WHEN ${BRANCH_LEGACY_VAT_INCLUSIVE}
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
          ELSE COALESCE(sale.agency_commission, sale.commission, 0)
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
          WHEN ${AGENCY_LEGACY_VAT_INCLUSIVE}
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
        ELSE COALESCE(sale.commission, 0)
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

/** Şube veya acente satırı için kayıtlı komisyon toplamı. */
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
        ELSE COALESCE(sale.branch_commission, 0)
        END
      ), 0)`,
      'displayTotal'
    )
    .addSelect(
      `COALESCE(SUM(
        CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
        WHEN ${BRANCH_LEGACY_VAT_INCLUSIVE}
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
        ELSE COALESCE(sale.agency_commission, sale.commission, 0)
        END
      ), 0)`,
      'displayTotal'
    )
    .addSelect(
      `COALESCE(SUM(
        CASE WHEN ${BALANCE_PAYMENT_EXISTS} THEN 0
        WHEN ${AGENCY_LEGACY_VAT_INCLUSIVE}
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

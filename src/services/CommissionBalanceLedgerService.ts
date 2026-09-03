import { EntityManager } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Agency } from '../entities/Agency';
import { Branch } from '../entities/Branch';
import { CommissionBalanceLedger } from '../entities/CommissionBalanceLedger';
import { CommissionLedgerEntityType, CommissionLedgerReason } from '../types/enums';
import { AppError } from '../middlewares/errorHandler';
import { randomUUID } from 'crypto';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ApplyBalanceDeltaInput {
  entityType: CommissionLedgerEntityType;
  entityId: string;
  delta: number;
  reason: CommissionLedgerReason;
  refType?: string | null;
  refId?: string | null;
  createdBy?: string | null;
  /** true ise bakiye negatif olamaz (ödeme / bakiye satışı) */
  disallowNegative?: boolean;
}

/**
 * Tek yazma yolu: agency/branch.balance güncelle + ledger kaydı.
 * EntityManager verilirse aynı transaction içinde çalışır.
 */
export async function applyCommissionBalanceDelta(
  input: ApplyBalanceDeltaInput,
  manager?: EntityManager
): Promise<number> {
  const delta = round2(parseFloat(String(input.delta)) || 0);

  if (delta === 0) {
    return await readCurrentBalance(input.entityType, input.entityId, manager);
  }

  const run = async (em: EntityManager): Promise<number> => {
    if (input.entityType === CommissionLedgerEntityType.BRANCH) {
      const branch = await em.findOne(Branch, { where: { id: input.entityId } });
      if (!branch) {
        throw new AppError(404, 'Şube bulunamadı');
      }
      const current = round2(parseFloat(branch.balance?.toString() || '0') || 0);
      const next = round2(current + delta);
      if (input.disallowNegative && next < -0.001) {
        throw new AppError(
          400,
          `Yetersiz şube bakiyesi. Mevcut: ${current.toFixed(2)} TL, İşlem: ${delta.toFixed(2)} TL`
        );
      }
      branch.balance = next as any;
      await em.save(branch);
      await insertLedger(em, {
        entityType: input.entityType,
        entityId: input.entityId,
        delta,
        balanceAfter: next,
        reason: input.reason,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        createdBy: input.createdBy ?? null,
      });
      return next;
    }

    const agency = await em.findOne(Agency, { where: { id: input.entityId } });
    if (!agency) {
      throw new AppError(404, 'Acente bulunamadı');
    }
    const current = round2(parseFloat(agency.balance?.toString() || '0') || 0);
    const next = round2(current + delta);
    if (input.disallowNegative && next < -0.001) {
      throw new AppError(
        400,
        `Yetersiz bakiye. Mevcut: ${current.toFixed(2)} TL, İşlem: ${delta.toFixed(2)} TL`
      );
    }
    agency.balance = next as any;
    await em.save(agency);
    await insertLedger(em, {
      entityType: input.entityType,
      entityId: input.entityId,
      delta,
      balanceAfter: next,
      reason: input.reason,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      createdBy: input.createdBy ?? null,
    });
    return next;
  };

  if (manager) {
    return run(manager);
  }
  return AppDataSource.transaction(async (em) => run(em));
}

/** Mutlak hedef bakiyeye çek (reconcile / ADJUSTMENT). */
export async function setCommissionBalanceAbsolute(
  input: {
    entityType: CommissionLedgerEntityType;
    entityId: string;
    targetBalance: number;
    reason?: CommissionLedgerReason;
    refType?: string | null;
    refId?: string | null;
    createdBy?: string | null;
  },
  manager?: EntityManager
): Promise<{ previous: number; next: number; delta: number }> {
  const target = round2(parseFloat(String(input.targetBalance)) || 0);
  const previous = await readCurrentBalance(input.entityType, input.entityId, manager);
  const delta = round2(target - previous);

  if (delta === 0) {
    return { previous, next: previous, delta: 0 };
  }

  const next = await applyCommissionBalanceDelta(
    {
      entityType: input.entityType,
      entityId: input.entityId,
      delta,
      reason: input.reason ?? CommissionLedgerReason.ADJUSTMENT,
      refType: input.refType ?? 'reconcile',
      refId: input.refId ?? null,
      createdBy: input.createdBy ?? null,
      disallowNegative: false,
    },
    manager
  );

  return { previous, next, delta };
}

async function readCurrentBalance(
  entityType: CommissionLedgerEntityType,
  entityId: string,
  manager?: EntityManager
): Promise<number> {
  const em = manager ?? AppDataSource.manager;
  if (entityType === CommissionLedgerEntityType.BRANCH) {
    const branch = await em.findOne(Branch, { where: { id: entityId } });
    return round2(parseFloat(branch?.balance?.toString() || '0') || 0);
  }
  const agency = await em.findOne(Agency, { where: { id: entityId } });
  return round2(parseFloat(agency?.balance?.toString() || '0') || 0);
}

async function insertLedger(
  em: EntityManager,
  row: {
    entityType: CommissionLedgerEntityType;
    entityId: string;
    delta: number;
    balanceAfter: number;
    reason: CommissionLedgerReason;
    refType: string | null;
    refId: string | null;
    createdBy: string | null;
  }
): Promise<void> {
  const entry = em.create(CommissionBalanceLedger, {
    id: randomUUID(),
    entity_type: row.entityType,
    entity_id: row.entityId,
    delta: row.delta as any,
    balance_after: row.balanceAfter as any,
    reason: row.reason,
    ref_type: row.refType,
    ref_id: row.refId,
    created_by: row.createdBy,
  });
  await em.save(entry);
}

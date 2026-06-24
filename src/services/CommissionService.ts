import { AppDataSource } from '../config/database';
import { CommissionRequest } from '../entities/CommissionRequest';
import { Agency } from '../entities/Agency';
import { Branch } from '../entities/Branch';
import { Sale } from '../entities/Sale';
import { UserAgency } from '../entities/UserAgency';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { CommissionRequestStatus, UserRole, PaymentType, PaymentStatus } from '../types/enums';
import { getAgencyRowDisplayEarned, getBranchRowDisplayEarned } from '../utils/commissionDisplay';

export class CommissionService {
  private commissionRepository = AppDataSource.getRepository(CommissionRequest);
  private agencyRepository = AppDataSource.getRepository(Agency);
  private branchRepository = AppDataSource.getRepository(Branch);
  private saleRepository = AppDataSource.getRepository(Sale);
  private userAgencyRepository = AppDataSource.getRepository(UserAgency);

  async getAll(filter?: any) {
    const queryBuilder = this.commissionRepository
      .createQueryBuilder('commission')
      .leftJoinAndSelect('commission.agency', 'agency')
      .leftJoinAndSelect('commission.branch', 'branch')
      .orderBy('commission.created_at', 'DESC');

    if (filter) {
      applyTenantFilter(queryBuilder, filter, 'commission');
    }

    const commissions = await queryBuilder.getMany();
    return commissions;
  }

  async getById(id: string) {
    const commission = await this.commissionRepository.findOne({
      where: { id },
      relations: ['agency', 'branch'],
    });

    if (!commission) {
      throw new AppError(404, 'Commission request not found');
    }

    return commission;
  }

  /**
   * Komisyon talebi oluştur. Acente ödemesi: agency_id, tutar <= agency.balance. Şube ödemesi: agency_id + branch_id, şube acenteye ait, tutar <= branch.balance.
   */
  async create(data: Partial<CommissionRequest>) {
    const amount = parseFloat((data.amount as any)?.toString() || '0') || 0;
    if (!data.agency_id) {
      throw new AppError(400, 'Acente seçimi zorunludur');
    }

    if (data.branch_id) {
      // Şube ödemesi: şube acenteye ait olmalı, tutar şube bakiyesini aşmamalı
      const branch = await this.branchRepository.findOne({
        where: { id: data.branch_id },
        relations: ['agency'],
      });
      if (!branch) {
        throw new AppError(404, 'Şube bulunamadı');
      }
      if (branch.agency_id !== data.agency_id) {
        throw new AppError(400, 'Şube seçilen acenteye ait değil');
      }
      const branchBalance = parseFloat(branch.balance?.toString() || '0') || 0;
      if (amount > branchBalance) {
        throw new AppError(400, `Talep tutarı şube bakiyesini aşamaz. Mevcut şube bakiyesi: ${branchBalance.toFixed(2)} TL`);
      }
    } else {
      // Acente ödemesi: tutar acente bakiyesini aşmamalı
      const agency = await this.agencyRepository.findOne({ where: { id: data.agency_id } });
      if (agency) {
        const balance = parseFloat(agency.balance?.toString() || '0') || 0;
        if (amount > balance) {
          throw new AppError(400, `Talep tutarı bakiyeden fazla olamaz. Mevcut bakiye: ${balance.toFixed(2)} TL`);
        }
      }
    }

    const commission = this.commissionRepository.create({
      ...data,
      status: CommissionRequestStatus.PENDING,
    });
    await this.commissionRepository.save(commission);
    return commission;
  }

  async approve(id: string) {
    const commission = await this.commissionRepository.findOne({ where: { id } });

    if (!commission) {
      throw new AppError(404, 'Commission request not found');
    }

    if (commission.status !== CommissionRequestStatus.PENDING) {
      throw new AppError(400, 'Commission request is not pending');
    }

    commission.status = CommissionRequestStatus.APPROVED;
    commission.approved_at = new Date();
    await this.commissionRepository.save(commission);

    return commission;
  }

  async reject(id: string, reason?: string) {
    const commission = await this.commissionRepository.findOne({ where: { id } });

    if (!commission) {
      throw new AppError(404, 'Commission request not found');
    }

    if (commission.status !== CommissionRequestStatus.PENDING) {
      throw new AppError(400, 'Commission request is not pending');
    }

    commission.status = CommissionRequestStatus.REJECTED;
    if (reason) {
      commission.notes = reason;
    }
    await this.commissionRepository.save(commission);

    return commission;
  }

  /**
   * Komisyon talebini ödendi olarak işaretle. Şube ödemesiyse branch.balance'dan, acente ödemesiyse agency.balance'dan düş.
   */
  async markAsPaid(id: string) {
    const commission = await this.commissionRepository.findOne({
      where: { id },
      relations: ['agency', 'branch'],
    });

    if (!commission) {
      throw new AppError(404, 'Commission request not found');
    }

    if (commission.status !== CommissionRequestStatus.APPROVED) {
      throw new AppError(400, 'Commission request must be approved first');
    }

    const amount = parseFloat(commission.amount?.toString() || '0') || 0;

    if (commission.branch_id) {
      const branch = await this.branchRepository.findOne({ where: { id: commission.branch_id } });
      if (!branch) {
        throw new AppError(404, 'Şube bulunamadı');
      }
      const currentBalance = parseFloat(branch.balance?.toString() || '0') || 0;
      if (currentBalance < amount) {
        throw new AppError(400, `Yetersiz şube bakiyesi. Mevcut: ${currentBalance.toFixed(2)} TL, Ödenecek: ${amount.toFixed(2)} TL`);
      }
      branch.balance = currentBalance - amount;
      await this.branchRepository.save(branch);
    } else {
      if (!commission.agency_id) {
        throw new AppError(400, 'Acente bilgisi bulunamadı');
      }
      const agency = await this.agencyRepository.findOne({ where: { id: commission.agency_id } });
      if (!agency) {
        throw new AppError(404, 'Agency not found');
      }
      const currentBalance = parseFloat(agency.balance?.toString() || '0') || 0;
      if (currentBalance < amount) {
        throw new AppError(400, `Yetersiz bakiye. Mevcut: ${currentBalance.toFixed(2)} TL, Ödenecek: ${amount.toFixed(2)} TL`);
      }
      agency.balance = currentBalance - amount;
      await this.agencyRepository.save(agency);
    }

    commission.status = CommissionRequestStatus.PAID;
    commission.paid_at = new Date();
    await this.commissionRepository.save(commission);

    return commission;
  }

  /**
   * Komisyon özeti: Acente ve şube alacaklarını ayrı satırlar olarak döndürür.
   * - Acente satırı: branchId/branchName null, totalEarned=agency_commission toplamı, totalPaid=acente ödemeleri (branch_id IS NULL), balance=agency.balance
   * - Şube satırı: branchId/branchName dolu, totalEarned=branch_commission toplamı, totalPaid=şube ödemeleri, balance=branch.balance
   * Super Admin tüm acenteleri, Agency Admin / Super Agency Admin kendi acentesini (veya yönettiklerini) görür.
   */
  async getSummary(filter?: any, currentUser?: any): Promise<{
    agencyId: string;
    agencyName: string;
    branchId: string | null;
    branchName: string | null;
    totalEarned: number;
    totalEarnedDisplay: number;
    legacyMismatchCount: number;
    totalPaid: number;
    balance: number;
    balancePaidCount: number;
    balancePaidAmount: number;
  }[]> {
    const agencyQb = this.agencyRepository
      .createQueryBuilder('agency')
      .select(['agency.id', 'agency.name', 'agency.balance']);

    if (currentUser?.role === UserRole.SUPER_AGENCY_ADMIN) {
      const userAgencies = await this.userAgencyRepository.find({
        where: { user_id: currentUser.id },
      });
      const managedAgencyIds = userAgencies.map(ua => ua.agency_id);
      if (managedAgencyIds.length > 0) {
        agencyQb.where('agency.id IN (:...agencyIds)', { agencyIds: managedAgencyIds });
      } else {
        agencyQb.where('1 = 0');
      }
    } else if (filter?.agency_id) {
      agencyQb.where('agency.id = :agency_id', { agency_id: filter.agency_id });
    }

    const agencies = await agencyQb.getMany();
    const rows: {
      agencyId: string;
      agencyName: string;
      branchId: string | null;
      branchName: string | null;
      totalEarned: number;
      totalEarnedDisplay: number;
      legacyMismatchCount: number;
      totalPaid: number;
      balance: number;
      balancePaidCount: number;
      balancePaidAmount: number;
    }[] = [];

    for (const agency of agencies) {
      // --- Acente satırı (şube yok) ---
      const agencyEarnedRaw = await this.saleRepository
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.agency_commission), 0)', 'total')
        .where('sale.agency_id = :agencyId', { agencyId: agency.id })
        .getRawOne<{ total: string }>();
      const agencyPaidRaw = await this.commissionRepository
        .createQueryBuilder('cr')
        .select('COALESCE(SUM(cr.amount), 0)', 'total')
        .where('cr.agency_id = :agencyId', { agencyId: agency.id })
        .andWhere('cr.branch_id IS NULL')
        .andWhere('cr.status = :status', { status: CommissionRequestStatus.PAID })
        .getRawOne<{ total: string }>();

      // Broker satırı: bakiye ile ödenen satışlar (branch_id IS NULL, agency_id = agency)
      const agencyBalancePaidRaw = await this.saleRepository
        .createQueryBuilder('sale')
        .innerJoin('sale.payments', 'payment', 'payment.type = :balanceType AND payment.status = :completedStatus', {
          balanceType: PaymentType.BALANCE,
          completedStatus: PaymentStatus.COMPLETED,
        })
        .where('sale.agency_id = :agencyId', { agencyId: agency.id })
        .andWhere('sale.branch_id IS NULL')
        .select('COUNT(sale.id)', 'count')
        .addSelect('COALESCE(SUM(sale.price), 0)', 'total')
        .getRawOne<{ count: string; total: string }>();

      const agencyDisplay = await getAgencyRowDisplayEarned(this.saleRepository, agency.id);

      rows.push({
        agencyId: agency.id,
        agencyName: agency.name,
        branchId: null,
        branchName: null,
        totalEarned: parseFloat(agencyEarnedRaw?.total || '0') || 0,
        totalEarnedDisplay: agencyDisplay.displayTotal,
        legacyMismatchCount: agencyDisplay.mismatchCount,
        totalPaid: parseFloat(agencyPaidRaw?.total || '0') || 0,
        balance: parseFloat(agency.balance?.toString() || '0') || 0,
        balancePaidCount: parseInt(agencyBalancePaidRaw?.count || '0', 10) || 0,
        balancePaidAmount: parseFloat(agencyBalancePaidRaw?.total || '0') || 0,
      });

      // --- Her şube için bir satır ---
      const branches = await this.branchRepository.find({
        where: { agency_id: agency.id },
        select: ['id', 'name', 'balance'],
      });

      for (const branch of branches) {
        const branchEarnedRaw = await this.saleRepository
          .createQueryBuilder('sale')
          .select('COALESCE(SUM(sale.branch_commission), 0)', 'total')
          .where('sale.branch_id = :branchId', { branchId: branch.id })
          .getRawOne<{ total: string }>();
        const branchPaidRaw = await this.commissionRepository
          .createQueryBuilder('cr')
          .select('COALESCE(SUM(cr.amount), 0)', 'total')
          .where('cr.branch_id = :branchId', { branchId: branch.id })
          .andWhere('cr.status = :status', { status: CommissionRequestStatus.PAID })
          .getRawOne<{ total: string }>();

        // Acente (şube) satırı: bakiye ile ödenen satışlar (branch_id = branch)
        const branchBalancePaidRaw = await this.saleRepository
          .createQueryBuilder('sale')
          .innerJoin('sale.payments', 'payment', 'payment.type = :balanceType AND payment.status = :completedStatus', {
            balanceType: PaymentType.BALANCE,
            completedStatus: PaymentStatus.COMPLETED,
          })
          .where('sale.branch_id = :branchId', { branchId: branch.id })
          .select('COUNT(sale.id)', 'count')
          .addSelect('COALESCE(SUM(sale.price), 0)', 'total')
          .getRawOne<{ count: string; total: string }>();

        const branchDisplay = await getBranchRowDisplayEarned(this.saleRepository, branch.id);

        rows.push({
          agencyId: agency.id,
          agencyName: agency.name,
          branchId: branch.id,
          branchName: branch.name,
          totalEarned: parseFloat(branchEarnedRaw?.total || '0') || 0,
          totalEarnedDisplay: branchDisplay.displayTotal,
          legacyMismatchCount: branchDisplay.mismatchCount,
          totalPaid: parseFloat(branchPaidRaw?.total || '0') || 0,
          balance: parseFloat(branch.balance?.toString() || '0') || 0,
          balancePaidCount: parseInt(branchBalancePaidRaw?.count || '0', 10) || 0,
          balancePaidAmount: parseFloat(branchBalancePaidRaw?.total || '0') || 0,
        });
      }
    }

    return rows;
  }

  /**
   * Bakiye ile ödenen satışların sayısı ve toplam tutarı (komisyon sayfalarında gösterilmek üzere).
   * Bu satışlarda komisyon kesilmediği için ayrıca yansıtılır.
   */
  async getBalancePaidStats(filter?: any): Promise<{ count: number; totalAmount: number }> {
    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .innerJoin('sale.payments', 'payment', 'payment.type = :balanceType AND payment.status = :completedStatus', {
        balanceType: PaymentType.BALANCE,
        completedStatus: PaymentStatus.COMPLETED,
      })
      .select('COUNT(sale.id)', 'count')
      .addSelect('COALESCE(SUM(sale.price), 0)', 'total');
    if (filter && Object.keys(filter).length > 0) {
      applyTenantFilter(qb, filter, 'sale', 'user_id');
    }
    const raw = await qb.getRawOne<{ count: string; total: string }>();
    return {
      count: parseInt(raw?.count || '0', 10) || 0,
      totalAmount: parseFloat(raw?.total || '0') || 0,
    };
  }
}

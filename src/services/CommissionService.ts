import { AppDataSource } from '../config/database';
import { CommissionRequest } from '../entities/CommissionRequest';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { CommissionRequestStatus } from '../types/enums';

export class CommissionService {
  private commissionRepository = AppDataSource.getRepository(CommissionRequest);

  async getAll(filter?: any) {
    const queryBuilder = this.commissionRepository
      .createQueryBuilder('commission')
      .leftJoinAndSelect('commission.agency', 'agency')
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
      relations: ['agency'],
    });

    if (!commission) {
      throw new AppError(404, 'Commission request not found');
    }

    return commission;
  }

  async create(data: Partial<CommissionRequest>) {
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

  async markAsPaid(id: string) {
    const commission = await this.commissionRepository.findOne({ where: { id } });

    if (!commission) {
      throw new AppError(404, 'Commission request not found');
    }

    if (commission.status !== CommissionRequestStatus.APPROVED) {
      throw new AppError(400, 'Commission request must be approved first');
    }

    commission.status = CommissionRequestStatus.PAID;
    commission.paid_at = new Date();
    await this.commissionRepository.save(commission);

    return commission;
  }
}

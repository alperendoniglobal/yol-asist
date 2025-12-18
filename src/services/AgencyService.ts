import { AppDataSource } from '../config/database';
import { Agency } from '../entities/Agency';
import { Sale } from '../entities/Sale';
import { Customer } from '../entities/Customer';
import { AppError } from '../middlewares/errorHandler';

export class AgencyService {
  private agencyRepository = AppDataSource.getRepository(Agency);
  private saleRepository = AppDataSource.getRepository(Sale);
  private customerRepository = AppDataSource.getRepository(Customer);

  async getAll(filter?: any) {
    const queryBuilder = this.agencyRepository
      .createQueryBuilder('agency')
      .leftJoinAndSelect('agency.branches', 'branches');

    if (filter?.agency_id) {
      queryBuilder.where('agency.id = :agency_id', { agency_id: filter.agency_id });
    }

    if (filter?.status) {
      queryBuilder.andWhere('agency.status = :status', { status: filter.status });
    }

    const agencies = await queryBuilder.getMany();
    return agencies;
  }

  async getById(id: string) {
    const agency = await this.agencyRepository.findOne({
      where: { id },
      relations: ['branches', 'users'],
    });

    if (!agency) {
      throw new AppError(404, 'Agency not found');
    }

    return agency;
  }

  async create(data: Partial<Agency>) {
    const agency = this.agencyRepository.create(data);
    await this.agencyRepository.save(agency);
    return agency;
  }

  async update(id: string, data: Partial<Agency>) {
    const agency = await this.getById(id);

    Object.assign(agency, data);
    await this.agencyRepository.save(agency);

    return agency;
  }

  async delete(id: string) {
    const agency = await this.getById(id);
    await this.agencyRepository.remove(agency);
    return { message: 'Agency deleted successfully' };
  }

  async getStats(agencyId: string) {
    const totalSales = await this.saleRepository.count({
      where: { agency_id: agencyId },
    });

    const totalRevenue = await this.saleRepository
      .createQueryBuilder('sale')
      .select('SUM(sale.price)', 'total')
      .where('sale.agency_id = :agencyId', { agencyId })
      .getRawOne();

    const totalCommission = await this.saleRepository
      .createQueryBuilder('sale')
      .select('SUM(sale.commission)', 'total')
      .where('sale.agency_id = :agencyId', { agencyId })
      .getRawOne();

    const totalCustomers = await this.customerRepository.count({
      where: { agency_id: agencyId },
    });

    return {
      totalSales,
      totalRevenue: parseFloat(totalRevenue?.total || '0'),
      totalCommission: parseFloat(totalCommission?.total || '0'),
      totalCustomers,
    };
  }
}

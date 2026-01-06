import { AppDataSource } from '../config/database';
import { Agency } from '../entities/Agency';
import { Sale } from '../entities/Sale';
import { Customer } from '../entities/Customer';
import { Branch } from '../entities/Branch';
import { UserAgency } from '../entities/UserAgency';
import { AppError } from '../middlewares/errorHandler';
import { UserRole } from '../types/enums';

export class AgencyService {
  private agencyRepository = AppDataSource.getRepository(Agency);
  private saleRepository = AppDataSource.getRepository(Sale);
  private customerRepository = AppDataSource.getRepository(Customer);
  private branchRepository = AppDataSource.getRepository(Branch);
  private userAgencyRepository = AppDataSource.getRepository(UserAgency);

  async getAll(filter?: any, currentUser?: any) {
    const queryBuilder = this.agencyRepository
      .createQueryBuilder('agency')
      .leftJoinAndSelect('agency.branches', 'branches');

    // SUPER_AGENCY_ADMIN için özel filtreleme: Sadece yönettiği brokerları göster
    if (currentUser?.role === UserRole.SUPER_AGENCY_ADMIN) {
      // user_agencies tablosundan kullanıcının yönettiği broker ID'lerini al
      const userAgencies = await this.userAgencyRepository.find({
        where: { user_id: currentUser.id },
      });
      
      const managedAgencyIds = userAgencies.map(ua => ua.agency_id);
      
      if (managedAgencyIds.length > 0) {
        // Sadece yönettiği brokerları göster (user_agencies tablosundan)
        // NOT: Eğer created_by kolonu eklenirse, oluşturduğu brokerları da ekleyebiliriz
        queryBuilder.where('agency.id IN (:...agencyIds)', { agencyIds: managedAgencyIds });
      } else {
        // Hiç broker yönetmiyorsa boş liste döndür
        queryBuilder.where('1 = 0'); // Her zaman false olan bir koşul
      }
    } else if (filter?.agency_id) {
      // Diğer roller için normal filtreleme
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

  async update(id: string, data: Partial<Agency>, currentUser?: any) {
    const agency = await this.getById(id);

    // SUPER_AGENCY_ADMIN sadece kendi yönettiği brokerları düzenleyebilir
    if (currentUser?.role === UserRole.SUPER_AGENCY_ADMIN) {
      const userAgencies = await this.userAgencyRepository.find({
        where: { user_id: currentUser.id },
      });
      
      const managedAgencyIds = userAgencies.map(ua => ua.agency_id);
      
      if (!managedAgencyIds.includes(id)) {
        throw new AppError(403, 'Bu brokerı düzenleme yetkiniz yok. Sadece yönettiğiniz brokerları düzenleyebilirsiniz.');
      }
    }

    Object.assign(agency, data);
    await this.agencyRepository.save(agency);

    return agency;
  }

  async delete(id: string, currentUser?: any) {
    const agency = await this.getById(id);

    // SUPER_AGENCY_ADMIN sadece kendi yönettiği brokerları silebilir
    if (currentUser?.role === UserRole.SUPER_AGENCY_ADMIN) {
      const userAgencies = await this.userAgencyRepository.find({
        where: { user_id: currentUser.id },
      });
      
      const managedAgencyIds = userAgencies.map(ua => ua.agency_id);
      
      if (!managedAgencyIds.includes(id)) {
        throw new AppError(403, 'Bu brokerı silme yetkiniz yok. Sadece yönettiğiniz brokerları silebilirsiniz.');
      }
    }

    await this.agencyRepository.remove(agency);
    return { message: 'Agency deleted successfully' };
  }

  /**
   * SUPER_AGENCY_ADMIN'a broker atama
   * Broker oluşturulduğunda otomatik olarak oluşturan kullanıcıya atanır
   * @param agencyId - Broker ID
   * @param userId - Kullanıcı ID
   */
  async assignAgencyToUser(agencyId: string, userId: string) {
    // Zaten atanmış mı kontrol et
    const existing = await this.userAgencyRepository.findOne({
      where: { user_id: userId, agency_id: agencyId },
    });

    if (existing) {
      return; // Zaten atanmış
    }

    // Junction table'a kayıt ekle
    const userAgency = this.userAgencyRepository.create({
      user_id: userId,
      agency_id: agencyId,
    });
    await this.userAgencyRepository.save(userAgency);
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

  /**
   * Acente için şube bazlı komisyon dağılım raporu
   * Her şube için: toplam satış, şube komisyonu, acente komisyonu hesaplanır
   * @param agencyId - Acente ID
   * @returns Şube bazlı komisyon dağılım raporu
   */
  async getBranchCommissionDistribution(agencyId: string) {
    // Acenteyi kontrol et
    const agency = await this.agencyRepository.findOne({
      where: { id: agencyId },
      relations: ['branches'],
    });

    if (!agency) {
      throw new AppError(404, 'Acente bulunamadı');
    }

    // Acentenin tüm şubelerini al
    const branches = await this.branchRepository.find({
      where: { agency_id: agencyId },
    });

    // Her şube için komisyon dağılımını hesapla
    const branchReports = await Promise.all(
      branches.map(async (branch) => {
        // Şubeye ait satışları al (branch_commission ve agency_commission ile)
        const sales = await this.saleRepository
          .createQueryBuilder('sale')
          .where('sale.branch_id = :branchId', { branchId: branch.id })
          .andWhere('sale.agency_id = :agencyId', { agencyId: agencyId })
          .getMany();

        // Toplam satış tutarı
        const totalSalesAmount = sales.reduce((sum, sale) => sum + Number(sale.price || 0), 0);

        // Şube komisyonu toplamı
        const totalBranchCommission = sales.reduce(
          (sum, sale) => sum + Number(sale.branch_commission || 0),
          0
        );

        // Acente komisyonu toplamı
        const totalAgencyCommission = sales.reduce(
          (sum, sale) => sum + Number(sale.agency_commission || 0),
          0
        );

        // Toplam komisyon (şube + acente)
        const totalCommission = totalBranchCommission + totalAgencyCommission;

        return {
          branch_id: branch.id,
          branch_name: branch.name,
          branch_commission_rate: Number(branch.commission_rate),
          agency_commission_rate: Number(agency.commission_rate),
          total_sales_count: sales.length,
          total_sales_amount: totalSalesAmount,
          total_branch_commission: totalBranchCommission,
          total_agency_commission: totalAgencyCommission,
          total_commission: totalCommission,
        };
      })
    );

    // Şube olmayan satışları da hesapla (sadece acente komisyonu)
    const salesWithoutBranch = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.agency_id = :agencyId', { agencyId: agencyId })
      .andWhere('sale.branch_id IS NULL')
      .getMany();

    const totalSalesWithoutBranch = salesWithoutBranch.reduce(
      (sum, sale) => sum + Number(sale.price || 0),
      0
    );

    const totalAgencyCommissionWithoutBranch = salesWithoutBranch.reduce(
      (sum, sale) => sum + Number(sale.agency_commission || 0),
      0
    );

    // Toplam özet
    const totalSummary = {
      total_sales_count: branchReports.reduce((sum, report) => sum + report.total_sales_count, 0) + salesWithoutBranch.length,
      total_sales_amount: branchReports.reduce((sum, report) => sum + report.total_sales_amount, 0) + totalSalesWithoutBranch,
      total_branch_commission: branchReports.reduce((sum, report) => sum + report.total_branch_commission, 0),
      total_agency_commission: branchReports.reduce((sum, report) => sum + report.total_agency_commission, 0) + totalAgencyCommissionWithoutBranch,
      total_commission: branchReports.reduce((sum, report) => sum + report.total_commission, 0) + totalAgencyCommissionWithoutBranch,
    };

    return {
      agency_id: agency.id,
      agency_name: agency.name,
      agency_commission_rate: Number(agency.commission_rate),
      branches: branchReports,
      sales_without_branch: {
        total_sales_count: salesWithoutBranch.length,
        total_sales_amount: totalSalesWithoutBranch,
        total_agency_commission: totalAgencyCommissionWithoutBranch,
      },
      summary: totalSummary,
    };
  }
}

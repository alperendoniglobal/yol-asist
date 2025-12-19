import { AppDataSource } from '../config/database';
import { Branch } from '../entities/Branch';
import { Sale } from '../entities/Sale';
import { Customer } from '../entities/Customer';
import { User } from '../entities/User';
import { Agency } from '../entities/Agency';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { EntityStatus } from '../types/enums';

export class BranchService {
  private branchRepository = AppDataSource.getRepository(Branch);
  private saleRepository = AppDataSource.getRepository(Sale);
  private customerRepository = AppDataSource.getRepository(Customer);
  private userRepository = AppDataSource.getRepository(User);
  private agencyRepository = AppDataSource.getRepository(Agency);

  // Tum subeleri getir
  async getAll(filter?: any) {
    const queryBuilder = this.branchRepository
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.agency', 'agency');

    if (filter) {
      // Agency filtresi uygula
      if (filter.agency_id) {
        queryBuilder.andWhere('branch.agency_id = :agency_id', {
          agency_id: filter.agency_id,
        });
      }

      // Branch filtresi uygula
      // Not: branches tablosu için branch_id yerine id kullanılmalı
      // Çünkü branches tablosunda branch_id kolonu yok, sadece id var
      if (filter.branch_id) {
        queryBuilder.andWhere('branch.id = :branch_id', {
          branch_id: filter.branch_id,
        });
      }
    }

    const branches = await queryBuilder.getMany();
    return branches;
  }

  // Sube detaylarini getir
  async getById(id: string) {
    const branch = await this.branchRepository.findOne({
      where: { id },
      relations: ['agency', 'users'],
    });

    if (!branch) {
      throw new AppError(404, 'Sube bulunamadi');
    }

    return branch;
  }

  // Sube detaylari ile performans istatistiklerini getir
  async getByIdWithStats(id: string) {
    const branch = await this.branchRepository.findOne({
      where: { id },
      relations: ['agency'],
    });

    if (!branch) {
      throw new AppError(404, 'Sube bulunamadi');
    }

    // Subedeki kullanicilari getir (silinmemis)
    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('user.branch_id = :branchId', { branchId: id })
      .andWhere('user.is_deleted = :isDeleted', { isDeleted: false })
      .select([
        'user.id',
        'user.name',
        'user.surname',
        'user.email',
        'user.phone',
        'user.role',
        'user.status',
        'user.created_at'
      ])
      .getMany();

    // Subenin satis istatistikleri
    const salesStats = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.branch_id = :branchId', { branchId: id })
      .select([
        'COUNT(sale.id) as total_sales',
        'SUM(sale.price) as total_revenue',
        'SUM(sale.commission) as total_commission',
      ])
      .getRawOne();

    // Subenin musteri sayisi
    const customerCount = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.branch_id = :branchId', { branchId: id })
      .getCount();

    // Son satislar (son 10)
    const recentSales = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.package', 'package')
      .leftJoinAndSelect('sale.user', 'user')
      .where('sale.branch_id = :branchId', { branchId: id })
      .orderBy('sale.created_at', 'DESC')
      .limit(10)
      .getMany();

    // Aylik satis trendi (son 6 ay)
    const monthlySales = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.branch_id = :branchId', { branchId: id })
      .andWhere('sale.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)')
      .select([
        "DATE_FORMAT(sale.created_at, '%Y-%m') as month",
        'COUNT(sale.id) as count',
        'SUM(sale.price) as revenue',
      ])
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // Kullanici bazli performans (top 5)
    const userPerformance = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.user', 'user')
      .where('sale.branch_id = :branchId', { branchId: id })
      .select([
        'user.id as user_id',
        'user.name as user_name',
        'user.surname as user_surname',
        'COUNT(sale.id) as sales_count',
        'SUM(sale.price) as total_revenue',
      ])
      .groupBy('user.id')
      .orderBy('total_revenue', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      ...branch,
      // Şubenin komisyon oranı (her şubenin kendi oranı var)
      commission_rate: Number(branch.commission_rate),
      // Acentenin maksimum komisyon oranı (karşılaştırma için)
      agency_max_commission: branch.agency ? Number(branch.agency.commission_rate) : 0,
      users: users.map(user => ({
        ...user,
        is_active: user.status === EntityStatus.ACTIVE,
      })),
      stats: {
        total_sales: parseInt(salesStats?.total_sales || '0'),
        total_revenue: parseFloat(salesStats?.total_revenue || '0'),
        total_commission: parseFloat(salesStats?.total_commission || '0'),
        customer_count: customerCount,
        user_count: users.length,
        active_user_count: users.filter(u => u.status === EntityStatus.ACTIVE).length,
        recent_sales: recentSales.map(sale => ({
          id: sale.id,
          customer_name: sale.customer?.name || 'Bilinmiyor',
          package_name: sale.package?.name || 'Bilinmiyor',
          user_name: sale.user ? `${sale.user.name} ${sale.user.surname}` : 'Bilinmiyor',
          price: sale.price,
          created_at: sale.created_at,
        })),
        monthly_sales: monthlySales.map((item: any) => ({
          month: item.month,
          count: parseInt(item.count) || 0,
          revenue: parseFloat(item.revenue) || 0,
        })),
        user_performance: userPerformance.map((item: any) => ({
          user_id: item.user_id,
          user_name: `${item.user_name || ''} ${item.user_surname || ''}`.trim() || 'Bilinmiyor',
          sales_count: parseInt(item.sales_count) || 0,
          total_revenue: parseFloat(item.total_revenue) || 0,
        })),
      },
    };
  }

  // Yeni sube olustur
  async create(data: Partial<Branch>) {
    // Komisyon oranı zorunlu kontrolü
    if (data.commission_rate === undefined || data.commission_rate === null) {
      throw new AppError(400, 'Komisyon orani zorunludur');
    }

    // Komisyon oranı 0-100 arasında olmalı
    if (data.commission_rate < 0 || data.commission_rate > 100) {
      throw new AppError(400, 'Komisyon orani 0-100 arasinda olmalidir');
    }

    // Acentenin komisyon oranını kontrol et - şube komisyonu acenteden fazla olamaz
    if (data.agency_id) {
      const agency = await this.agencyRepository.findOne({ where: { id: data.agency_id } });
      if (agency && Number(data.commission_rate) > Number(agency.commission_rate)) {
        throw new AppError(400, `Sube komisyon orani acente komisyon oranindan (${agency.commission_rate}%) fazla olamaz`);
      }
    }

    const branch = this.branchRepository.create(data);
    await this.branchRepository.save(branch);
    return branch;
  }

  // Sube guncelle
  async update(id: string, data: Partial<Branch>) {
    const branch = await this.getById(id);
    
    // Komisyon oranı güncelleniyorsa validasyon yap
    if (data.commission_rate !== undefined) {
      // Komisyon oranı 0-100 arasında olmalı
      if (data.commission_rate < 0 || data.commission_rate > 100) {
        throw new AppError(400, 'Komisyon orani 0-100 arasinda olmalidir');
      }

      // Acentenin komisyon oranını kontrol et - şube komisyonu acenteden fazla olamaz
      const agency = await this.agencyRepository.findOne({ where: { id: branch.agency_id } });
      if (agency && Number(data.commission_rate) > Number(agency.commission_rate)) {
        throw new AppError(400, `Sube komisyon orani acente komisyon oranindan (${agency.commission_rate}%) fazla olamaz`);
      }
    }

    Object.assign(branch, data);
    await this.branchRepository.save(branch);
    return branch;
  }

  // Sube sil
  async delete(id: string) {
    const branch = await this.getById(id);
    await this.branchRepository.remove(branch);
    return { message: 'Sube basariyla silindi' };
  }

  /**
   * Şubenin komisyon oranını ve acente maksimum oranını getirir
   * @param branchId - Şube ID
   * @returns Şube komisyon oranı ve acente maksimum oranı
   */
  async getCommissionRate(branchId: string): Promise<{ commission_rate: number; agency_max_commission: number }> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
      relations: ['agency'],
    });

    if (!branch) {
      throw new AppError(404, 'Sube bulunamadi');
    }

    return {
      commission_rate: Number(branch.commission_rate),
      agency_max_commission: branch.agency ? Number(branch.agency.commission_rate) : 0
    };
  }

  /**
   * Şubenin komisyon oranını günceller
   * Komisyon oranı zorunludur ve acente oranından fazla olamaz
   * @param id - Şube ID
   * @param commissionRate - Yeni komisyon oranı
   */
  async updateCommissionRate(id: string, commissionRate: number) {
    const branch = await this.getById(id);

    // Komisyon oranı zorunlu
    if (commissionRate === undefined || commissionRate === null) {
      throw new AppError(400, 'Komisyon orani zorunludur');
    }

    // Komisyon oranı validasyonu
    if (commissionRate < 0 || commissionRate > 100) {
      throw new AppError(400, 'Komisyon orani 0-100 arasinda olmalidir');
    }

    // Acentenin komisyon oranını kontrol et - şube komisyonu acenteden fazla olamaz
    const agency = await this.agencyRepository.findOne({ where: { id: branch.agency_id } });
    if (agency && Number(commissionRate) > Number(agency.commission_rate)) {
      throw new AppError(400, `Sube komisyon orani acente komisyon oranindan (${agency.commission_rate}%) fazla olamaz`);
    }

    branch.commission_rate = commissionRate;
    await this.branchRepository.save(branch);
    
    return branch;
  }

  /**
   * Tüm şubeleri komisyon bilgileriyle birlikte getirir
   * Her şubenin kendi komisyon oranı vardır
   */
  async getAllWithCommission(filter?: any) {
    const queryBuilder = this.branchRepository
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.agency', 'agency');

    if (filter) {
      // Agency filtresi uygula
      if (filter.agency_id) {
        queryBuilder.andWhere('branch.agency_id = :agency_id', {
          agency_id: filter.agency_id,
        });
      }

      // Branch filtresi uygula
      // Not: branches tablosu için branch_id yerine id kullanılmalı
      // Çünkü branches tablosunda branch_id kolonu yok, sadece id var
      if (filter.branch_id) {
        queryBuilder.andWhere('branch.id = :branch_id', {
          branch_id: filter.branch_id,
        });
      }
    }

    const branches = await queryBuilder.getMany();

    // Her şubenin kendi komisyon oranını döndür
    return branches.map(branch => ({
      ...branch,
      // Şubenin komisyon oranı (her şubenin kendi oranı var)
      commission_rate: Number(branch.commission_rate),
      // Acentenin maksimum komisyon oranı (karşılaştırma için)
      agency_max_commission: branch.agency ? Number(branch.agency.commission_rate) : 0
    }));
  }
}

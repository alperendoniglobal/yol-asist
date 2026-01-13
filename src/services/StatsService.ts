import { AppDataSource } from '../config/database';
import { Sale } from '../entities/Sale';
import { Payment } from '../entities/Payment';
import { Customer } from '../entities/Customer';
import { Agency } from '../entities/Agency';
import { Branch } from '../entities/Branch';
import { User } from '../entities/User';
import { UserAgency } from '../entities/UserAgency';
import { IsNull } from 'typeorm';
import { applyTenantFilter, applyAgencyFilter } from '../middlewares/tenantMiddleware';
import { UserRole } from '../types/enums';

export class StatsService {
  private saleRepository = AppDataSource.getRepository(Sale);
  private paymentRepository = AppDataSource.getRepository(Payment);
  private customerRepository = AppDataSource.getRepository(Customer);
  private agencyRepository = AppDataSource.getRepository(Agency);
  private branchRepository = AppDataSource.getRepository(Branch);
  private userRepository = AppDataSource.getRepository(User);
  private userAgencyRepository = AppDataSource.getRepository(UserAgency);

  // Dashboard istatistikleri
  async getDashboard(filter?: any) {
    const salesQb = this.saleRepository.createQueryBuilder('sale');
    const paymentsQb = this.paymentRepository.createQueryBuilder('payment');
    const customersQb = this.customerRepository.createQueryBuilder('customer');

    // Filter varsa VE içinde değer varsa uygula (tenant filtering)
    if (filter && Object.keys(filter).length > 0) {
      // Sale için user_id kolonu kullanılır (created_by yok)
      applyTenantFilter(salesQb, filter, 'sale', 'user_id');
      // Payment'ta sadece agency_id var (branch_id ve created_by yok)
      applyAgencyFilter(paymentsQb, filter, 'payment');
      // Customer için standart created_by kolonu
      applyTenantFilter(customersQb, filter, 'customer');
    }

    // Komisyon hesaplaması: Şube yöneticisi için branch_commission, Acente admin için agency_commission, diğerleri için toplam commission
    let commissionColumn = 'sale.commission'; // Varsayılan: toplam komisyon
    if (filter && filter.branch_id) {
      // Şube yöneticisi: sadece kendi şubesinin komisyonunu görür
      commissionColumn = 'COALESCE(sale.branch_commission, 0)';
    } else if (filter && filter.agency_id && !filter.branch_id) {
      // Acente admin: acente komisyonunu görür (şube komisyonu hariç)
      commissionColumn = 'COALESCE(sale.agency_commission, sale.commission, 0)';
    }

    const [
      totalSales,
      totalCustomers,
      totalRevenue,
      totalCommission,
    ] = await Promise.all([
      salesQb.getCount(),
      customersQb.getCount(),
      salesQb.clone().select('SUM(sale.price)', 'total').getRawOne(),
      salesQb.clone().select(`SUM(${commissionColumn})`, 'total').getRawOne(),
    ]);

    // Son satışları getir
    const recentSalesQb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.package', 'package')
      .orderBy('sale.created_at', 'DESC')
      .limit(10);

    if (filter) {
      applyTenantFilter(recentSalesQb, filter, 'sale', 'user_id');
    }

    const recentSales = await recentSalesQb.getMany();

    // ===== SON 7 GÜNÜN GÜNLÜK SATIŞLARI =====
    // Bu daha mantıklı çünkü proje yeni olsa bile günlük veri gösterir
    const dailySalesQb = this.saleRepository.createQueryBuilder('sale');

    // Son 7 günün günlük satışlarını getir
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Bugün dahil 7 gün
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // ÖNCE where ile tarih filtresi, SONRA tenant filter (andWhere kullanır)
    dailySalesQb
      .select("DATE(sale.created_at)", 'date')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.price)', 'revenue')
      .where('sale.created_at >= :startDate', { startDate: sevenDaysAgo });
    
    // Tenant filter'ı SONRA uygula (applyTenantFilter kullan)
    if (filter && Object.keys(filter).length > 0) {
      applyTenantFilter(dailySalesQb, filter, 'sale', 'user_id');
    }

    const dailySalesRaw = await dailySalesQb
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Gün isimlerini Türkçe'ye çevir ve eksik günleri doldur
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const dailySales: Array<{ day: string; date: string; count: number; revenue: number }> = [];
    
    // Son 7 günü oluştur (bugün dahil)
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      const dayName = dayNames[date.getDay()];
      const dayNum = date.getDate();
      
      // Bu tarihte satış var mı bak
      const found = dailySalesRaw.find((item: any) => {
        const itemDate = new Date(item.date).toISOString().split('T')[0];
        return itemDate === dateStr;
      });
      
      dailySales.push({
        day: `${dayName} ${dayNum}`,
        date: dateStr,
        count: found ? parseInt(found.count) || 0 : 0,
        revenue: found ? parseFloat(found.revenue) || 0 : 0,
      });
    }

    // ===== AYLIK SATIŞLAR (opsiyonel - yine de tutalım) =====
    const monthlySalesQb = this.saleRepository.createQueryBuilder('sale');
    
    // Tenant filter'ı düzgün uygula
    monthlySalesQb
      .select("DATE_FORMAT(sale.created_at, '%Y-%m')", 'month')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.price)', 'revenue');
    
    // Filter varsa WHERE clause ekle (applyTenantFilter kullan)
    if (filter && Object.keys(filter).length > 0) {
      applyTenantFilter(monthlySalesQb, filter, 'sale', 'user_id');
    }
    
    const monthlySalesRaw = await monthlySalesQb
      .groupBy('month')
      .orderBy('month', 'ASC')
      .limit(12)
      .getRawMany();

    // Ay isimlerini Türkçe'ye çevir
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const monthlySales = monthlySalesRaw.map((item: any) => {
      const [year, monthNum] = item.month.split('-');
      const monthIndex = parseInt(monthNum) - 1;
      return {
        month: `${monthNames[monthIndex]} ${year.slice(2)}`,
        count: parseInt(item.count) || 0,
        revenue: parseFloat(item.revenue) || 0,
      };
    });

    // Paket dağılımını getir (top packages)
    const topPackagesQb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.package', 'package')
      .select('package.name', 'name')
      .addSelect('COUNT(sale.id)', 'count');

    // Filter varsa WHERE clause ekle (applyTenantFilter kullan)
    if (filter && Object.keys(filter).length > 0) {
      applyTenantFilter(topPackagesQb, filter, 'sale', 'user_id');
    }

    const topPackagesRaw = await topPackagesQb
      .groupBy('package.id')
      .orderBy('count', 'DESC')
      .limit(6)
      .getRawMany();
    const topPackages = topPackagesRaw.map((item: any) => ({
      name: item.name || 'Bilinmeyen Paket',
      count: parseInt(item.count) || 0,
    }));

    // ===== ACENTE PERFORMANS KARŞILAŞTIRMASI =====
    // SUPER_ADMIN ve SUPER_AGENCY_ADMIN için anlamlı - diğer roller için boş döner
    let agencyPerformance: any[] = [];
    
    // SUPER_ADMIN için filter undefined gelir veya userRole yok
    // SUPER_AGENCY_ADMIN için managed_agency_ids var ve agency_id undefined
    // AGENCY_ADMIN ve diğerleri için agency_id var, onlar için gösterme
    const isSuperAdmin = !filter || (!filter.userRole || filter.userRole === 'SUPER_ADMIN');
    const isSuperAgencyAdmin = filter && filter.userRole === 'SUPER_AGENCY_ADMIN' && !filter.agency_id;
    const shouldShowAgencyPerformance = isSuperAdmin || (isSuperAgencyAdmin && filter.managed_agency_ids && filter.managed_agency_ids.length > 0);
    
    if (shouldShowAgencyPerformance) {
      const agencyPerformanceQb = this.saleRepository
        .createQueryBuilder('sale')
        .leftJoin('sale.agency', 'agency')
        .select('agency.id', 'id')
        .addSelect('agency.name', 'name')
        .addSelect('COUNT(sale.id)', 'salesCount')
        .addSelect('SUM(sale.price)', 'totalRevenue')
        .addSelect('SUM(sale.commission)', 'totalCommission');
      
      // SUPER_AGENCY_ADMIN için sadece yönettiği brokerları göster
      if (isSuperAgencyAdmin && filter.managed_agency_ids && filter.managed_agency_ids.length > 0) {
        agencyPerformanceQb.where('sale.agency_id IN (:...managedAgencyIds)', {
          managedAgencyIds: filter.managed_agency_ids,
        });
      }
      
      const agencyPerformanceRaw = await agencyPerformanceQb
        .groupBy('agency.id')
        .orderBy('totalRevenue', 'DESC')
        .limit(10)
        .getRawMany();

      agencyPerformance = agencyPerformanceRaw.map((item: any) => ({
        id: item.id,
        name: item.name || 'Bilinmeyen Acente',
        salesCount: parseInt(item.salesCount) || 0,
        totalRevenue: parseFloat(item.totalRevenue) || 0,
        totalCommission: parseFloat(item.totalCommission) || 0,
      }));
    }

    // ===== İADE İSTATİSTİKLERİ =====
    // Super Admin ve Agency Admin için iade bilgileri
    const refundStatsQb = this.saleRepository.createQueryBuilder('sale')
      .where('sale.is_refunded = :isRefunded', { isRefunded: true });
    
    // Tenant filter uygula (applyTenantFilter kullan)
    if (filter && Object.keys(filter).length > 0) {
      applyTenantFilter(refundStatsQb, filter, 'sale', 'user_id');
    }

    // Toplam iade sayısı ve tutarı
    const refundStats = await refundStatsQb.clone()
      .select('COUNT(sale.id)', 'totalRefunds')
      .addSelect('SUM(sale.refund_amount)', 'totalRefundAmount')
      .getRawOne();

    // Son iadeler listesi (detaylı)
    const recentRefundsQb = this.saleRepository.createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.vehicle', 'vehicle')
      .leftJoinAndSelect('sale.package', 'package')
      .leftJoinAndSelect('sale.agency', 'agency')
      .where('sale.is_refunded = :isRefunded', { isRefunded: true })
      .orderBy('sale.refunded_at', 'DESC')
      .limit(10);

    // Tenant filter uygula (applyTenantFilter kullan)
    if (filter && Object.keys(filter).length > 0) {
      applyTenantFilter(recentRefundsQb, filter, 'sale', 'user_id');
    }

    const recentRefunds = await recentRefundsQb.getMany();

    return {
      totalSales,
      totalCustomers,
      totalRevenue: parseFloat(totalRevenue?.total || '0'),
      totalCommission: parseFloat(totalCommission?.total || '0'),
      recentSales,
      dailySales,           // Son 7 günün günlük satışları
      monthlySales,         // Aylık satışlar (opsiyonel)
      topPackages,
      agencyPerformance,    // Acente performans karşılaştırması
      // İade istatistikleri (yeni)
      totalRefunds: parseInt(refundStats?.totalRefunds) || 0,
      totalRefundAmount: parseFloat(refundStats?.totalRefundAmount) || 0,
      recentRefunds,        // Son iadeler listesi
    };
  }

  // Satış istatistikleri
  async getSalesStats(filter?: any) {
    const queryBuilder = this.saleRepository.createQueryBuilder('sale');

    if (filter) {
      applyTenantFilter(queryBuilder, filter, 'sale', 'user_id');
    }

    const monthlySales = await queryBuilder
      .select('DATE_FORMAT(sale.created_at, "%Y-%m") as month')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.price)', 'revenue')
      .addSelect('SUM(sale.commission)', 'commission')
      .groupBy('month')
      .orderBy('month', 'DESC')
      .limit(12)
      .getRawMany();

    // Paket bazlı satışlar için yeni query builder oluştur
    const salesByPackageQb = this.saleRepository.createQueryBuilder('sale');
    if (filter) {
      applyTenantFilter(salesByPackageQb, filter, 'sale', 'user_id');
    }

    const salesByPackage = await salesByPackageQb
      .leftJoin('sale.package', 'package')
      .select('package.name', 'packageName')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.price)', 'revenue')
      .groupBy('package.id')
      .orderBy('count', 'DESC')
      .getRawMany();

    return {
      monthlySales,
      salesByPackage,
    };
  }

  // Gelir istatistikleri
  async getRevenueStats(filter?: any) {
    const queryBuilder = this.paymentRepository.createQueryBuilder('payment');

    if (filter) {
      // Payment'ta sadece agency_id var
      applyAgencyFilter(queryBuilder, filter, 'payment');
    }

    const monthlyRevenue = await queryBuilder
      .select('DATE_FORMAT(payment.created_at, "%Y-%m") as month')
      .addSelect('SUM(payment.amount)', 'amount')
      .addSelect('COUNT(payment.id)', 'count')
      .groupBy('month')
      .orderBy('month', 'DESC')
      .limit(12)
      .getRawMany();

    // Ödeme türüne göre gelir için yeni query builder oluştur
    const revenueByTypeQb = this.paymentRepository.createQueryBuilder('payment');
    if (filter) {
      applyAgencyFilter(revenueByTypeQb, filter, 'payment');
    }

    const revenueByType = await revenueByTypeQb
      .select('payment.type', 'type')
      .addSelect('SUM(payment.amount)', 'amount')
      .addSelect('COUNT(payment.id)', 'count')
      .groupBy('payment.type')
      .getRawMany();

    return {
      monthlyRevenue,
      revenueByType,
    };
  }

  // Müşteri istatistikleri
  async getCustomerStats(filter?: any) {
    const queryBuilder = this.customerRepository.createQueryBuilder('customer');

    if (filter) {
      applyTenantFilter(queryBuilder, filter, 'customer');
    }

    const monthlyCustomers = await queryBuilder
      .select('DATE_FORMAT(customer.created_at, "%Y-%m") as month')
      .addSelect('COUNT(customer.id)', 'count')
      .groupBy('month')
      .orderBy('month', 'DESC')
      .limit(12)
      .getRawMany();

    const totalCustomers = await this.customerRepository.createQueryBuilder('customer')
      .where(filter?.agency_id ? 'customer.agency_id = :agency_id' : '1=1', { agency_id: filter?.agency_id })
      .andWhere(filter?.branch_id ? 'customer.branch_id = :branch_id' : '1=1', { branch_id: filter?.branch_id })
      .andWhere(filter?.created_by ? 'customer.created_by = :created_by' : '1=1', { created_by: filter?.created_by })
      .getCount();

    return {
      totalCustomers,
      monthlyCustomers,
    };
  }

  // Acente istatistikleri (sadece SUPER_ADMIN için)
  async getAgencyStats(filter?: any) {
    const agencies = await this.agencyRepository
      .createQueryBuilder('agency')
      .leftJoin('agency.sales', 'sale')
      .select('agency.id', 'id')
      .addSelect('agency.name', 'name')
      .addSelect('COUNT(DISTINCT sale.id)', 'totalSales')
      .addSelect('SUM(sale.price)', 'totalRevenue')
      .addSelect('SUM(sale.commission)', 'totalCommission')
      .groupBy('agency.id')
      .orderBy('totalRevenue', 'DESC')
      .getRawMany();

    return agencies;
  }

  /**
   * Seçilen broker için satış trendi ve detaylı istatistikler
   * @param agencyId - Broker ID
   * @param startDate - Başlangıç tarihi (opsiyonel)
   * @param endDate - Bitiş tarihi (opsiyonel)
   * @returns Günlük, aylık satış trendi ve detaylı istatistikler
   */
  async getAgencySalesData(agencyId: string, startDate?: string, endDate?: string) {
    // Tarih filtrelerini hazırla
    let dateFilter: any = {};
    let defaultStartDate: Date | null = null;
    
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      dateFilter.startDate = start;
    } else {
      // Varsayılan: Son 30 gün
      defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - 30);
      dateFilter.startDate = defaultStartDate;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.endDate = end;
    }
    
    // Günlük satışlar
    const dailySalesQb = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.agency_id = :agencyId', { agencyId });
    
    if (dateFilter.startDate) {
      dailySalesQb.andWhere('sale.created_at >= :startDate', { startDate: dateFilter.startDate });
    }
    if (dateFilter.endDate) {
      dailySalesQb.andWhere('sale.created_at <= :endDate', { endDate: dateFilter.endDate });
    }
    
    const dailySales = await dailySalesQb
      .select('DATE(sale.created_at)', 'date')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.price)', 'revenue')
      .addSelect('SUM(sale.commission)', 'commission')
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Aylık satışlar
    const monthlySalesQb = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.agency_id = :agencyId', { agencyId });
    
    if (dateFilter.startDate) {
      monthlySalesQb.andWhere('sale.created_at >= :startDate', { startDate: dateFilter.startDate });
    }
    if (dateFilter.endDate) {
      monthlySalesQb.andWhere('sale.created_at <= :endDate', { endDate: dateFilter.endDate });
    }
    
    const monthlySales = await monthlySalesQb
      .select('DATE_FORMAT(sale.created_at, "%Y-%m")', 'month')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.price)', 'revenue')
      .addSelect('SUM(sale.commission)', 'commission')
      .groupBy('month')
      .orderBy('month', 'DESC')
      .limit(12)
      .getRawMany();

    // Şube bazlı satışlar
    const branchSalesQb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.branch', 'branch')
      .where('sale.agency_id = :agencyId', { agencyId });
    
    if (dateFilter.startDate) {
      branchSalesQb.andWhere('sale.created_at >= :startDate', { startDate: dateFilter.startDate });
    }
    if (dateFilter.endDate) {
      branchSalesQb.andWhere('sale.created_at <= :endDate', { endDate: dateFilter.endDate });
    }
    
    const branchSales = await branchSalesQb
      .select('branch.id', 'branchId')
      .addSelect('branch.name', 'branchName')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.price)', 'revenue')
      .addSelect('SUM(sale.commission)', 'commission')
      .groupBy('branch.id')
      .orderBy('revenue', 'DESC')
      .getRawMany();

    // Kullanıcı bazlı satışlar (tüm kullanıcılar)
    const userSalesQb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.user', 'user')
      .where('sale.agency_id = :agencyId', { agencyId });
    
    if (dateFilter.startDate) {
      userSalesQb.andWhere('sale.created_at >= :startDate', { startDate: dateFilter.startDate });
    }
    if (dateFilter.endDate) {
      userSalesQb.andWhere('sale.created_at <= :endDate', { endDate: dateFilter.endDate });
    }
    
    const userSales = await userSalesQb
      .select('user.id', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('user.surname', 'userSurname')
      .addSelect('user.email', 'userEmail')
      .addSelect('user.role', 'userRole')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.price)', 'revenue')
      .addSelect('SUM(sale.commission)', 'commission')
      .groupBy('user.id')
      .orderBy('revenue', 'DESC')
      .getRawMany();

    // Paket bazlı satışlar
    const packageSalesQb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.package', 'package')
      .where('sale.agency_id = :agencyId', { agencyId });
    
    if (dateFilter.startDate) {
      packageSalesQb.andWhere('sale.created_at >= :startDate', { startDate: dateFilter.startDate });
    }
    if (dateFilter.endDate) {
      packageSalesQb.andWhere('sale.created_at <= :endDate', { endDate: dateFilter.endDate });
    }
    
    const packageSales = await packageSalesQb
      .select('package.id', 'packageId')
      .addSelect('package.name', 'packageName')
      .addSelect('package.vehicle_type', 'vehicleType')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.price)', 'revenue')
      .addSelect('SUM(sale.commission)', 'commission')
      .groupBy('package.id')
      .orderBy('count', 'DESC')
      .getRawMany();

    // Kullanıcı ve paket kombinasyonu (kim hangi paketi satmış)
    const userPackageSalesQb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.user', 'user')
      .leftJoin('sale.package', 'package')
      .where('sale.agency_id = :agencyId', { agencyId });
    
    if (dateFilter.startDate) {
      userPackageSalesQb.andWhere('sale.created_at >= :startDate', { startDate: dateFilter.startDate });
    }
    if (dateFilter.endDate) {
      userPackageSalesQb.andWhere('sale.created_at <= :endDate', { endDate: dateFilter.endDate });
    }
    
    const userPackageSales = await userPackageSalesQb
      .select('user.id', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('user.surname', 'userSurname')
      .addSelect('package.id', 'packageId')
      .addSelect('package.name', 'packageName')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.price)', 'revenue')
      .addSelect('SUM(sale.commission)', 'commission')
      .groupBy('user.id')
      .addGroupBy('package.id')
      .orderBy('count', 'DESC')
      .getRawMany();

    return {
      dailySales: dailySales.map(item => ({
        date: item.date,
        count: parseInt(item.count) || 0,
        revenue: parseFloat(item.revenue) || 0,
        commission: parseFloat(item.commission) || 0
      })),
      monthlySales: monthlySales.map(item => ({
        month: item.month,
        count: parseInt(item.count) || 0,
        revenue: parseFloat(item.revenue) || 0,
        commission: parseFloat(item.commission) || 0
      })),
      branchSales: branchSales.map(item => ({
        branchId: item.branchId,
        branchName: item.branchName || 'Merkez',
        count: parseInt(item.count) || 0,
        revenue: parseFloat(item.revenue) || 0,
        commission: parseFloat(item.commission) || 0
      })),
      userSales: userSales.map(item => ({
        userId: item.userId,
        userName: `${item.userName} ${item.userSurname || ''}`.trim(),
        userEmail: item.userEmail,
        userRole: item.userRole,
        count: parseInt(item.count) || 0,
        revenue: parseFloat(item.revenue) || 0,
        commission: parseFloat(item.commission) || 0
      })),
      packageSales: packageSales.map(item => ({
        packageId: item.packageId,
        packageName: item.packageName,
        vehicleType: item.vehicleType,
        count: parseInt(item.count) || 0,
        revenue: parseFloat(item.revenue) || 0,
        commission: parseFloat(item.commission) || 0
      })),
      userPackageSales: userPackageSales.map(item => ({
        userId: item.userId,
        userName: `${item.userName} ${item.userSurname || ''}`.trim(),
        packageId: item.packageId,
        packageName: item.packageName,
        count: parseInt(item.count) || 0,
        revenue: parseFloat(item.revenue) || 0,
        commission: parseFloat(item.commission) || 0
      }))
    };
  }

  /**
   * SUPER_ADMIN ve SUPER_AGENCY_ADMIN için performans raporu
   * SUPER_ADMIN: Tüm agency'leri gösterir
   * SUPER_AGENCY_ADMIN: Yönettiği agency'leri gösterir
   * 
   * @param currentUser - Mevcut kullanıcı (SUPER_ADMIN veya SUPER_AGENCY_ADMIN olmalı)
   * @returns Agency, branch ve user bazlı performans raporu
   */
  async getSuperAgencyAdminPerformanceReport(currentUser: any) {
    let agencies: Agency[] = [];
    
    // SUPER_ADMIN ise tüm agency'leri getir
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      agencies = await this.agencyRepository
        .createQueryBuilder('agency')
        .orderBy('agency.name', 'ASC')
        .getMany();
    } else {
      // SUPER_AGENCY_ADMIN ise sadece yönettiği agency'leri getir
      const userAgencies = await this.userAgencyRepository.find({
        where: { user_id: currentUser.id },
        relations: ['agency'],
      });

      if (userAgencies.length === 0) {
        return {
          agencies: [],
          summary: {
            totalAgencies: 0,
            totalBranches: 0,
            totalUsers: 0,
            totalSales: 0,
            totalRevenue: 0,
            totalCommission: 0,
          },
        };
      }

      const managedAgencyIds = userAgencies.map(ua => ua.agency_id);

      // Agency'leri detaylı olarak getir
      agencies = await this.agencyRepository
        .createQueryBuilder('agency')
        .where('agency.id IN (:...agencyIds)', { agencyIds: managedAgencyIds })
        .orderBy('agency.name', 'ASC')
        .getMany();
    }

    // Her agency için branch'leri ve user'ları getir
    const result = await Promise.all(
      agencies.map(async (agency) => {
        // Agency'nin branch'lerini getir
        const branches = await this.branchRepository.find({
          where: { agency_id: agency.id },
          order: { name: 'ASC' },
        });

        // Agency'nin toplam satış istatistikleri
        const agencySalesStats = await this.saleRepository
          .createQueryBuilder('sale')
          .where('sale.agency_id = :agencyId', { agencyId: agency.id })
          .select([
            'COUNT(sale.id) as total_sales',
            'SUM(sale.price) as total_revenue',
            'SUM(sale.commission) as total_commission',
          ])
          .getRawOne();

        // Her branch için detaylı bilgiler
        const branchesWithDetails = await Promise.all(
          branches.map(async (branch) => {
            // Branch'in user'larını getir (silinmemiş ve aktif olanlar)
            const users = await this.userRepository.find({
              where: {
                branch_id: branch.id,
                is_deleted: false,
              },
              order: { name: 'ASC' },
            });

            // Branch'in toplam satış istatistikleri
            const branchSalesStats = await this.saleRepository
              .createQueryBuilder('sale')
              .where('sale.branch_id = :branchId', { branchId: branch.id })
              .select([
                'COUNT(sale.id) as total_sales',
                'SUM(sale.price) as total_revenue',
                'SUM(sale.commission) as total_commission',
              ])
              .getRawOne();

            // Her user için satış performansı
            const usersWithPerformance = await Promise.all(
              users.map(async (user) => {
                const userSalesStats = await this.saleRepository
                  .createQueryBuilder('sale')
                  .where('sale.user_id = :userId', { userId: user.id })
                  .select([
                    'COUNT(sale.id) as total_sales',
                    'SUM(sale.price) as total_revenue',
                    'SUM(sale.commission) as total_commission',
                  ])
                  .getRawOne();

                return {
                  id: user.id,
                  name: user.name,
                  surname: user.surname,
                  email: user.email,
                  phone: user.phone,
                  role: user.role,
                  status: user.status,
                  performance: {
                    totalSales: parseInt(userSalesStats?.total_sales || '0'),
                    totalRevenue: parseFloat(userSalesStats?.total_revenue || '0'),
                    totalCommission: parseFloat(userSalesStats?.total_commission || '0'),
                  },
                };
              })
            );

            return {
              id: branch.id,
              name: branch.name,
              address: branch.address,
              phone: branch.phone,
              status: branch.status,
              commission_rate: parseFloat(branch.commission_rate.toString()),
              balance: parseFloat(branch.balance.toString()),
              performance: {
                totalSales: parseInt(branchSalesStats?.total_sales || '0'),
                totalRevenue: parseFloat(branchSalesStats?.total_revenue || '0'),
                totalCommission: parseFloat(branchSalesStats?.total_commission || '0'),
              },
              users: usersWithPerformance,
            };
          })
        );

        // Agency'ye bağlı ama branch'i olmayan user'ları da getir (merkez çalışanları)
        const agencyUsersWithoutBranch = await this.userRepository.find({
          where: {
            agency_id: agency.id,
            branch_id: IsNull(),
            is_deleted: false,
          },
          order: { name: 'ASC' },
        });

        const agencyUsersWithPerformance = await Promise.all(
          agencyUsersWithoutBranch.map(async (user) => {
            const userSalesStats = await this.saleRepository
              .createQueryBuilder('sale')
              .where('sale.user_id = :userId', { userId: user.id })
              .select([
                'COUNT(sale.id) as total_sales',
                'SUM(sale.price) as total_revenue',
                'SUM(sale.commission) as total_commission',
              ])
              .getRawOne();

            return {
              id: user.id,
              name: user.name,
              surname: user.surname,
              email: user.email,
              phone: user.phone,
              role: user.role,
              status: user.status,
              performance: {
                totalSales: parseInt(userSalesStats?.total_sales || '0'),
                totalRevenue: parseFloat(userSalesStats?.total_revenue || '0'),
                totalCommission: parseFloat(userSalesStats?.total_commission || '0'),
              },
            };
          })
        );

        return {
          id: agency.id,
          name: agency.name,
          tax_number: agency.tax_number,
          address: agency.address,
          phone: agency.phone,
          email: agency.email,
          status: agency.status,
          commission_rate: parseFloat(agency.commission_rate.toString()),
          balance: parseFloat(agency.balance.toString()),
          performance: {
            totalSales: parseInt(agencySalesStats?.total_sales || '0'),
            totalRevenue: parseFloat(agencySalesStats?.total_revenue || '0'),
            totalCommission: parseFloat(agencySalesStats?.total_commission || '0'),
          },
          branches: branchesWithDetails,
          agencyUsers: agencyUsersWithPerformance, // Branch'i olmayan merkez çalışanları
        };
      })
    );

    // Toplam özet istatistikleri hesapla
    const summary = {
      totalAgencies: result.length,
      totalBranches: result.reduce((sum, agency) => sum + agency.branches.length, 0),
      totalUsers: result.reduce(
        (sum, agency) =>
          sum +
          agency.branches.reduce((branchSum, branch) => branchSum + branch.users.length, 0) +
          agency.agencyUsers.length,
        0
      ),
      totalSales: result.reduce((sum, agency) => sum + agency.performance.totalSales, 0),
      totalRevenue: result.reduce((sum, agency) => sum + agency.performance.totalRevenue, 0),
      totalCommission: result.reduce((sum, agency) => sum + agency.performance.totalCommission, 0),
    };

    return {
      agencies: result,
      summary,
    };
  }
}

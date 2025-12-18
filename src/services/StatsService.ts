import { AppDataSource } from '../config/database';
import { Sale } from '../entities/Sale';
import { Payment } from '../entities/Payment';
import { Customer } from '../entities/Customer';
import { Agency } from '../entities/Agency';
import { applyTenantFilter, applyAgencyFilter } from '../middlewares/tenantMiddleware';

export class StatsService {
  private saleRepository = AppDataSource.getRepository(Sale);
  private paymentRepository = AppDataSource.getRepository(Payment);
  private customerRepository = AppDataSource.getRepository(Customer);
  private agencyRepository = AppDataSource.getRepository(Agency);

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

    const [
      totalSales,
      totalCustomers,
      totalRevenue,
      totalCommission,
    ] = await Promise.all([
      salesQb.getCount(),
      customersQb.getCount(),
      salesQb.clone().select('SUM(sale.price)', 'total').getRawOne(),
      salesQb.clone().select('SUM(sale.commission)', 'total').getRawOne(),
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
    
    // Tenant filter'ı SONRA uygula (andWhere ile)
    if (filter && Object.keys(filter).length > 0) {
      if (filter.agency_id) {
        dailySalesQb.andWhere('sale.agency_id = :agency_id', { agency_id: filter.agency_id });
      }
      if (filter.branch_id) {
        dailySalesQb.andWhere('sale.branch_id = :branch_id', { branch_id: filter.branch_id });
      }
      if (filter.created_by) {
        dailySalesQb.andWhere('sale.user_id = :created_by', { created_by: filter.created_by });
      }
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
    
    // Filter varsa WHERE clause ekle
    if (filter && Object.keys(filter).length > 0) {
      if (filter.agency_id) {
        monthlySalesQb.where('sale.agency_id = :agency_id', { agency_id: filter.agency_id });
      }
      if (filter.branch_id) {
        monthlySalesQb.andWhere('sale.branch_id = :branch_id', { branch_id: filter.branch_id });
      }
      if (filter.created_by) {
        monthlySalesQb.andWhere('sale.user_id = :created_by', { created_by: filter.created_by });
      }
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

    // Filter varsa WHERE clause ekle
    if (filter && Object.keys(filter).length > 0) {
      if (filter.agency_id) {
        topPackagesQb.where('sale.agency_id = :agency_id', { agency_id: filter.agency_id });
      }
      if (filter.branch_id) {
        topPackagesQb.andWhere('sale.branch_id = :branch_id', { branch_id: filter.branch_id });
      }
      if (filter.created_by) {
        topPackagesQb.andWhere('sale.user_id = :created_by', { created_by: filter.created_by });
      }
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
    // Bu sadece Super Admin için anlamlı - diğer roller için boş döner
    // Çünkü acente admin zaten kendi acentesinin verilerini görüyor
    let agencyPerformance: any[] = [];
    
    // Eğer filter varsa (yani Super Admin değilse) agencyPerformance boş kalır
    // Super Admin için filter undefined gelir
    if (!filter || !filter.agency_id) {
    const agencyPerformanceRaw = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.agency', 'agency')
      .select('agency.id', 'id')
      .addSelect('agency.name', 'name')
      .addSelect('COUNT(sale.id)', 'salesCount')
      .addSelect('SUM(sale.price)', 'totalRevenue')
      .addSelect('SUM(sale.commission)', 'totalCommission')
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
    
    // Tenant filter uygula
    if (filter && Object.keys(filter).length > 0) {
      if (filter.agency_id) {
        refundStatsQb.andWhere('sale.agency_id = :agency_id', { agency_id: filter.agency_id });
      }
      if (filter.branch_id) {
        refundStatsQb.andWhere('sale.branch_id = :branch_id', { branch_id: filter.branch_id });
      }
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

    // Tenant filter uygula
    if (filter && Object.keys(filter).length > 0) {
      if (filter.agency_id) {
        recentRefundsQb.andWhere('sale.agency_id = :agency_id', { agency_id: filter.agency_id });
      }
      if (filter.branch_id) {
        recentRefundsQb.andWhere('sale.branch_id = :branch_id', { branch_id: filter.branch_id });
      }
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
}

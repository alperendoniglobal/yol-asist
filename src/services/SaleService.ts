import { AppDataSource } from '../config/database';
import { Sale } from '../entities/Sale';
import { Branch } from '../entities/Branch';
import { Agency } from '../entities/Agency';
import { Customer } from '../entities/Customer';
import { Vehicle } from '../entities/Vehicle';
import { Payment } from '../entities/Payment';
import { Package } from '../entities/Package';
import { User } from '../entities/User';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { PaymentType, PaymentStatus, UsageType, UserRole } from '../types/enums';
import { resolvePolicyDates, normalizeToYmd, addYearsYmd } from '../utils/policyDates';
import { SmsService } from './SmsService';
import { VehicleService } from './VehicleService';

// Komple satış için input tipi
interface CompleteSaleInput {
  // Müşteri bilgileri
  customer: {
    id?: string;  // Mevcut müşteri için
    is_corporate: boolean;
    tc_vkn: string;
    name: string;
    surname?: string;
    tax_office?: string;
    birth_date?: string;
    phone: string;
    email?: string;
    city?: string;
    district?: string;
    address?: string;
  };
  // Araç bilgileri
  vehicle: {
    vehicle_type: string; // Araç tipi: Otomobil, Motosiklet, vs.
    is_foreign_plate: boolean;
    plate: string;
    registration_serial?: string;
    registration_number?: string;
    brand_id?: number; // Otomobil için
    model_id?: number; // Otomobil için
    motor_brand_id?: number; // Motosiklet için
    motor_model_id?: number; // Motosiklet için
    /** Katalog dışı marka (ID yoksa zorunlu) */
    brand_name?: string;
    /** Katalog dışı model (ID yoksa zorunlu) */
    model_name?: string;
    model_year: number;
    usage_type: string;
  };
  // Satış bilgileri
  sale: {
    package_id: string;
    /** Opsiyonel; yoksa bugün+7. Bitiş sunucuda start+1y türetilir. */
    start_date?: string;
    end_date?: string;
    price: number;
    commission?: number;
  };
  // Ödeme bilgileri
  payment: {
    type: PaymentType;
    cardDetails?: {
      cardHolderName: string;
      cardNumber: string;
      expireMonth: string;
      expireYear: string;
      cvc: string;
    };
  };
  // Kullanıcı bilgileri (controller'dan gelecek)
  user_id?: string;
  agency_id?: string | null;
  branch_id?: string | null;
}

export class SaleService {
  private saleRepository = AppDataSource.getRepository(Sale);
  private branchRepository = AppDataSource.getRepository(Branch);
  private agencyRepository = AppDataSource.getRepository(Agency);
  private customerRepository = AppDataSource.getRepository(Customer);
  private vehicleRepository = AppDataSource.getRepository(Vehicle);
  private paymentRepository = AppDataSource.getRepository(Payment);
  private packageRepository = AppDataSource.getRepository(Package);
  private userRepository = AppDataSource.getRepository(User);
  private vehicleService = new VehicleService();

  /** KDV oranı (%20) - İade hesaplarında kullanılır */
  private static readonly KDV_RATE = 0.20;

  /**
   * KDV dahil fiyattan net fiyat (KDV hariç) hesaplar — yalnızca iade hesapları için.
   * @param priceWithVat - KDV dahil satış fiyatı (TL)
   * @returns KDV hariç net fiyat (TL)
   */
  private getNetPrice(priceWithVat: number): number {
    return priceWithVat / (1 + SaleService.KDV_RATE);
  }

  /**
   * Satış numarası oluştur
   * Format: YYYYMMDD-HHMMSS-RANDOM
   * Örnek: 20250115-143025-7891
   */
  private generatePolicyNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
  }

  // Satışları listele (tenant filter + opsiyonel ödeme türü filtresi ile)
  // paymentType: BALANCE veya PAYTR verilirse sadece o ödeme türündeki satışlar döner
  async getAll(filter?: any, search?: string, userRole?: string, paymentType?: string) {
    const queryBuilder = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.vehicle', 'vehicle')
      .leftJoinAndSelect('vehicle.brand', 'brand')
      .leftJoinAndSelect('vehicle.model', 'model')
      .leftJoinAndSelect('vehicle.motorBrand', 'motorBrand')
      .leftJoinAndSelect('vehicle.motorModel', 'motorModel')
      .leftJoinAndSelect('sale.package', 'package')
      .leftJoinAndSelect('sale.agency', 'agency')
      .leftJoinAndSelect('sale.branch', 'branch')
      .leftJoinAndSelect('sale.user', 'user')
      .leftJoinAndSelect('sale.payments', 'payments')
      .orderBy('sale.created_at', 'DESC');

    // Tenant filter uygula
    if (filter) {
      // Sale entity'sinde 'created_by' yerine 'user_id' kolonu var
      applyTenantFilter(queryBuilder, filter, 'sale', 'user_id');
    }

    // Ödeme türüne göre filtrele (Bakiye / PayTR)
    if (paymentType && (paymentType === PaymentType.BALANCE || paymentType === PaymentType.PAYTR)) {
      queryBuilder.andWhere(
        'EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = sale.id AND p.type = :paymentType)',
        { paymentType }
      );
    }

    // Search query uygula
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      
      // SUPPORT rolü için sadece satış numarası ve plaka ile arama
      if (userRole === UserRole.SUPPORT) {
        queryBuilder.andWhere(
          `(sale.policy_number LIKE :search OR 
            vehicle.plate LIKE :search)`,
          { search: searchTerm }
        );
      } else {
        // Diğer roller için tüm alanlarda arama
        queryBuilder.andWhere(
          `(customer.name LIKE :search OR 
            customer.surname LIKE :search OR 
            customer.tc_vkn LIKE :search OR 
            vehicle.plate LIKE :search OR 
            package.name LIKE :search OR 
            agency.name LIKE :search OR 
            branch.name LIKE :search OR 
            sale.policy_number LIKE :search OR 
            sale.id LIKE :search)`,
          { search: searchTerm }
        );
      }
    }

    const sales = await queryBuilder.getMany();
    // Vehicle'ları normalize et - brand ve model her zaman gelsin
    return sales.map(sale => {
      if (sale.vehicle) {
        sale.vehicle = this.vehicleService.normalizeVehicle(sale.vehicle) as Vehicle;
      }
      return sale;
    });
  }

  // Excel export için satışları getir (tarih aralığı + tenant filter)
  async getForExport(filter?: any, startDate?: string, endDate?: string) {
    const queryBuilder = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.vehicle', 'vehicle')
      .leftJoinAndSelect('vehicle.brand', 'brand')
      .leftJoinAndSelect('vehicle.model', 'model')
      .leftJoinAndSelect('vehicle.motorBrand', 'motorBrand')
      .leftJoinAndSelect('vehicle.motorModel', 'motorModel')
      .leftJoinAndSelect('sale.package', 'package')
      .leftJoinAndSelect('sale.agency', 'agency')
      .leftJoinAndSelect('sale.branch', 'branch')
      .leftJoinAndSelect('sale.user', 'user')
      .orderBy('sale.created_at', 'DESC');

    // Tenant filter uygula
    if (filter) {
      applyTenantFilter(queryBuilder, filter, 'sale', 'user_id');
    }

    // Tarih aralığı filtresi
    if (startDate) {
      queryBuilder.andWhere('sale.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('sale.created_at <= :endDate', { endDate: `${endDate} 23:59:59` });
    }

    const sales = await queryBuilder.getMany();
    // Vehicle'ları normalize et - brand ve model her zaman gelsin
    return sales.map(sale => {
      if (sale.vehicle) {
        sale.vehicle = this.vehicleService.normalizeVehicle(sale.vehicle) as Vehicle;
      }
      return sale;
    });
  }

  // ID ile satış getir
  async getById(id: string) {
    const sale = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.vehicle', 'vehicle')
      .leftJoinAndSelect('vehicle.brand', 'brand')
      .leftJoinAndSelect('vehicle.model', 'model')
      .leftJoinAndSelect('vehicle.motorBrand', 'motorBrand')
      .leftJoinAndSelect('vehicle.motorModel', 'motorModel')
      .leftJoinAndSelect('sale.package', 'package')
      .leftJoinAndSelect('sale.agency', 'agency')
      .leftJoinAndSelect('sale.branch', 'branch')
      .leftJoinAndSelect('sale.user', 'user')
      .leftJoinAndSelect('sale.payments', 'payments')
      .where('sale.id = :id', { id })
      .getOne();

    if (!sale) {
      throw new AppError(404, 'Satış bulunamadı');
    }

    // Vehicle'ı normalize et - brand ve model her zaman gelsin
    if (sale.vehicle) {
      sale.vehicle = this.vehicleService.normalizeVehicle(sale.vehicle) as Vehicle;
    }

    return sale;
  }

  /**
   * Satış için komisyon oranını hesaplar
   * Öncelik: 1. Şube komisyonu, 2. Acente komisyonu
   * @param branchId - Şube ID (opsiyonel, null olabilir)
   * @param agencyId - Acente ID (opsiyonel, null olabilir)
   * @returns Komisyon oranı (%)
   */
  async getCommissionRate(branchId: string | null, agencyId: string | null): Promise<number> {
    // Şube varsa şube komisyonunu kullan
    if (branchId) {
      const branch = await this.branchRepository.findOne({ where: { id: branchId } });
      if (branch && branch.commission_rate !== null) {
        return Number(branch.commission_rate);
      }
    }
    
    // Şube yoksa veya şube komisyonu yoksa acente komisyonunu kullan
    if (agencyId) {
      const agency = await this.agencyRepository.findOne({ where: { id: agencyId } });
      if (agency) {
        return Number(agency.commission_rate);
      }
    }
    
    // Varsayılan %20 (şube ve acente yoksa)
    return 20;
  }

  /**
   * Komisyon tutarını hesaplar.
   * KDV dahil satış fiyatı üzerinden: 1000 TL × %30 = 300 TL.
   * @param price - KDV dahil satış fiyatı (TL)
   * @param commissionRate - Komisyon oranı (%)
   * @returns Komisyon tutarı (TL)
   */
  calculateCommission(price: number, commissionRate: number): number {
    return (price * commissionRate) / 100;
  }

  /**
   * Dağılımlı komisyon hesaplar.
   * Komisyon KDV dahil satış fiyatı üzerinden: fiyat × oran / 100.
   * Şube varsa: Şube kendi komisyonunu alır, kalan kısım acenteye gider. Şube yoksa: Sadece acente komisyonu.
   * @param price - KDV dahil satış fiyatı (TL)
   * @param branchId - Şube ID (opsiyonel)
   * @param agencyId - Acente ID (opsiyonel)
   * @returns { branch_commission, agency_commission, total_commission }
   */
  async calculateDistributedCommission(
    price: number,
    branchId: string | null,
    agencyId: string | null
  ): Promise<{
    branch_commission: number | null;
    agency_commission: number | null;
    total_commission: number;
  }> {
    // 1. Şube varsa: Dağılımlı komisyon hesapla
    if (branchId) {
      const branch = await this.branchRepository.findOne({ where: { id: branchId } });
      if (!branch) {
        throw new AppError(404, 'Şube bulunamadı');
      }

      // Acente bilgisi gerekli (şube bir acenteye bağlı olmalı)
      if (!branch.agency_id) {
        throw new AppError(400, 'Şube bir acenteye bağlı olmalı');
      }

      const agency = await this.agencyRepository.findOne({ where: { id: branch.agency_id } });
      if (!agency) {
        throw new AppError(404, 'Acente bulunamadı');
      }

      const branchRate = Number(branch.commission_rate);
      const agencyRate = Number(agency.commission_rate);

      // Validasyon: Şube komisyon oranı acente komisyon oranından fazla olamaz
      if (branchRate > agencyRate) {
        throw new AppError(400, `Şube komisyon oranı (${branchRate}%) acente komisyon oranından (${agencyRate}%) fazla olamaz`);
      }

      const branchCommission = (price * branchRate) / 100;
      const agencyCommission = (price * (agencyRate - branchRate)) / 100;
      const totalCommission = (price * agencyRate) / 100;

      return {
        branch_commission: branchCommission,
        agency_commission: agencyCommission,
        total_commission: totalCommission,
      };
    }

    // 2. Şube yoksa ama acente varsa: Sadece acente komisyonu
    if (agencyId) {
      const agency = await this.agencyRepository.findOne({ where: { id: agencyId } });
      if (!agency) {
        throw new AppError(404, 'Acente bulunamadı');
      }

      const agencyRate = Number(agency.commission_rate);
      const agencyCommission = (price * agencyRate) / 100;

      return {
        branch_commission: null,
        agency_commission: agencyCommission,
        total_commission: agencyCommission,
      };
    }

    // 3. İkisi de yoksa: Varsayılan %20 (KDV dahil fiyat üzerinden)
    const defaultRate = 20;
    const defaultCommission = (price * defaultRate) / 100;

    return {
      branch_commission: null,
      agency_commission: defaultCommission,
      total_commission: defaultCommission,
    };
  }

  // Yeni satış oluştur
  async create(data: Partial<Sale>) {
    // Dağılımlı komisyon hesapla (eğer hesaplanmamışsa)
    if (data.price && (data.branch_commission === undefined || data.agency_commission === undefined || data.commission === undefined)) {
      const distributedCommission = await this.calculateDistributedCommission(
        Number(data.price),
        data.branch_id || null,
        data.agency_id || null
      );

      // Dağılımlı komisyon değerlerini set et
      data.branch_commission = distributedCommission.branch_commission;
      data.agency_commission = distributedCommission.agency_commission;
      data.commission = distributedCommission.total_commission;
    }
    
    // Satış numarası yoksa otomatik oluştur
    if (!data.policy_number) {
      data.policy_number = this.generatePolicyNumber();
    }
    
    const sale = this.saleRepository.create(data);
    await this.saleRepository.save(sale);
    return sale;
  }

  // Satış güncelle
  async update(id: string, data: Partial<Sale>) {
    const sale = await this.saleRepository.findOne({ where: { id } });

    if (!sale) {
      throw new AppError(404, 'Satış bulunamadı');
    }

    Object.assign(sale, data);
    await this.saleRepository.save(sale);
    return sale;
  }

  /**
   * Super Admin: poliçe başlangıç/bitiş tarihlerini güncelle.
   * end_date yoksa start + 1 yıl türetilir. Geçmiş tarihe izin verilir (düzeltme senaryosu).
   */
  async updateDates(id: string, startDate: string, endDate?: string | null) {
    const sale = await this.saleRepository.findOne({
      where: { id },
      relations: ['customer', 'vehicle', 'package', 'agency', 'branch', 'user', 'payments'],
    });

    if (!sale) {
      throw new AppError(404, 'Satış bulunamadı');
    }

    const start = normalizeToYmd(startDate);
    if (!start) {
      throw new AppError(400, 'Geçersiz başlangıç tarihi');
    }

    let end: string;
    if (endDate?.toString().trim()) {
      const normalizedEnd = normalizeToYmd(endDate.toString());
      if (!normalizedEnd) {
        throw new AppError(400, 'Geçersiz bitiş tarihi');
      }
      if (normalizedEnd <= start) {
        throw new AppError(400, 'Bitiş tarihi başlangıçtan sonra olmalıdır');
      }
      end = normalizedEnd;
    } else {
      end = addYearsYmd(start, 1);
    }

    sale.start_date = start as any;
    sale.end_date = end as any;
    await this.saleRepository.save(sale);
    return sale;
  }

  /**
   * Super Admin: satışı başka kullanıcıya ata.
   * Hedef kullanıcının agency_id / branch_id'si satışa yazılır; komisyon yeni oranlarla yeniden hesaplanır.
   * PayTR (komisyonlu) satışlarda eski cüzdanlardan düşülüp yeni cüzdanlara eklenir.
   */
  async assignSeller(id: string, newUserId: string) {
    if (!newUserId?.trim()) {
      throw new AppError(400, 'Yeni satıcı kullanıcı ID zorunludur');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sale = await queryRunner.manager.findOne(Sale, {
        where: { id },
        relations: ['payments'],
      });

      if (!sale) {
        throw new AppError(404, 'Satış bulunamadı');
      }

      if (sale.is_refunded) {
        throw new AppError(400, 'İade edilmiş satış yeniden atanamaz');
      }

      const newUser = await queryRunner.manager.findOne(User, {
        where: { id: newUserId },
        relations: ['agency', 'branch'],
      });

      if (!newUser) {
        throw new AppError(404, 'Hedef kullanıcı bulunamadı');
      }

      if (newUser.is_deleted) {
        throw new AppError(400, 'Silinmiş kullanıcıya satış atanamaz');
      }

      if (sale.user_id === newUser.id
        && sale.agency_id === (newUser.agency_id || null)
        && sale.branch_id === (newUser.branch_id || null)) {
        throw new AppError(400, 'Satış zaten bu kullanıcıya ait');
      }

      const oldAgencyId = sale.agency_id;
      const oldBranchId = sale.branch_id;
      const oldBranchCommission = parseFloat(sale.branch_commission?.toString() || '0') || 0;
      const oldAgencyCommission = parseFloat(sale.agency_commission?.toString() || '0') || 0;

      const payment = (sale.payments || []).find(
        (p) => p.status === PaymentStatus.COMPLETED || p.status === PaymentStatus.PENDING
      ) || (sale.payments || [])[0];

      const isBalancePaid = payment?.type === PaymentType.BALANCE;
      const shouldMoveCommission =
        !isBalancePaid
        && payment?.status === PaymentStatus.COMPLETED
        && (oldBranchCommission > 0 || oldAgencyCommission > 0);

      // Eski cüzdanlardan komisyon düş
      if (shouldMoveCommission) {
        if (oldBranchId && oldBranchCommission > 0) {
          const oldBranch = await queryRunner.manager.findOne(Branch, { where: { id: oldBranchId } });
          if (oldBranch) {
            const bal = parseFloat(oldBranch.balance?.toString() || '0') || 0;
            oldBranch.balance = bal - oldBranchCommission;
            await queryRunner.manager.save(oldBranch);
          }
        }
        if (oldAgencyId && oldAgencyCommission > 0) {
          const oldAgency = await queryRunner.manager.findOne(Agency, { where: { id: oldAgencyId } });
          if (oldAgency) {
            const bal = parseFloat(oldAgency.balance?.toString() || '0') || 0;
            oldAgency.balance = bal - oldAgencyCommission;
            await queryRunner.manager.save(oldAgency);
          }
        }
      }

      const newAgencyId = newUser.agency_id || null;
      const newBranchId = newUser.branch_id || null;

      let branchCommission: number | null = null;
      let agencyCommission: number | null = null;
      let totalCommission = 0;

      if (isBalancePaid) {
        // Bakiye ile ödemede komisyon yok
        branchCommission = null;
        agencyCommission = null;
        totalCommission = 0;
      } else {
        const distributed = await this.calculateDistributedCommission(
          Number(sale.price),
          newBranchId,
          newAgencyId
        );
        branchCommission = distributed.branch_commission;
        agencyCommission = distributed.agency_commission;
        totalCommission = distributed.total_commission;
      }

      sale.user_id = newUser.id;
      sale.agency_id = newAgencyId;
      sale.branch_id = newBranchId;
      sale.branch_commission = branchCommission as any;
      sale.agency_commission = agencyCommission as any;
      sale.commission = totalCommission as any;
      await queryRunner.manager.save(sale);

      // Yeni cüzdanlara komisyon ekle
      if (!isBalancePaid && payment?.status === PaymentStatus.COMPLETED) {
        const newBranchComm = parseFloat(String(branchCommission || 0)) || 0;
        const newAgencyComm = parseFloat(String(agencyCommission || 0)) || 0;

        if (newBranchId && newBranchComm > 0) {
          const newBranch = await queryRunner.manager.findOne(Branch, { where: { id: newBranchId } });
          if (newBranch) {
            const bal = parseFloat(newBranch.balance?.toString() || '0') || 0;
            newBranch.balance = bal + newBranchComm;
            await queryRunner.manager.save(newBranch);
          }
        }
        if (newAgencyId && newAgencyComm > 0) {
          const newAgency = await queryRunner.manager.findOne(Agency, { where: { id: newAgencyId } });
          if (newAgency) {
            const bal = parseFloat(newAgency.balance?.toString() || '0') || 0;
            newAgency.balance = bal + newAgencyComm;
            await queryRunner.manager.save(newAgency);
          }
        }
      }

      // Ödeme kaydındaki agency_id'yi de güncelle
      if (payment) {
        payment.agency_id = newAgencyId;
        await queryRunner.manager.save(payment);
      }

      await queryRunner.commitTransaction();

      return await this.saleRepository.findOne({
        where: { id },
        relations: ['customer', 'vehicle', 'package', 'agency', 'branch', 'user', 'payments'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Satış sil
  async delete(id: string) {
    const sale = await this.saleRepository.findOne({ where: { id } });

    if (!sale) {
      throw new AppError(404, 'Satış bulunamadı');
    }

    await this.saleRepository.remove(sale);
    return { message: 'Sale deleted successfully' };
  }

  /**
   * Komple satış işlemi - Transaction içinde tüm adımları yapar
   * Herhangi bir adımda hata olursa tüm işlemler geri alınır
   * 
   * Adımlar:
   * 1. Müşteri oluştur veya güncelle
   * 2. Araç bul veya oluştur
   * 3. Satış oluştur
   * 4. Ödeme işle
   */
  async completeSale(input: CompleteSaleInput) {
    // ÖNCE VALİDASYON KONTROLLERİ - Eksik alanları kontrol et
    const missingFields: string[] = [];
    
    // Müşteri bilgileri kontrolü
    if (!input.customer) {
      missingFields.push('Müşteri bilgileri');
    } else {
      if (!input.customer.name || input.customer.name.trim() === '') {
        missingFields.push('Müşteri adı');
      }
      if (!input.customer.tc_vkn || input.customer.tc_vkn.trim() === '') {
        missingFields.push('T.C. Kimlik No / Vergi No');
      }
      if (!input.customer.phone || input.customer.phone.trim() === '') {
        missingFields.push('Müşteri telefon numarası');
      }
    }
    
    // Araç bilgileri kontrolü
    if (!input.vehicle) {
      missingFields.push('Araç bilgileri');
    } else {
      if (!input.vehicle.plate || input.vehicle.plate.trim() === '') {
        missingFields.push('Plaka numarası');
      }
      if (!input.vehicle.model_year) {
        missingFields.push('Model yılı');
      }
      if (!input.vehicle.usage_type) {
        missingFields.push('Kullanım tipi');
      }
      if (!input.vehicle.vehicle_type) {
        missingFields.push('Araç tipi');
      }
      // Marka/model: katalog ID veya serbest metin
      const brandName = input.vehicle.brand_name?.trim();
      const modelName = input.vehicle.model_name?.trim();
      if (input.vehicle.vehicle_type !== 'Motosiklet') {
        const hasIds = !!input.vehicle.brand_id && !!input.vehicle.model_id;
        const hasNames = !!brandName && !!modelName;
        if (!hasIds && !hasNames) {
          missingFields.push('Araç markası');
          missingFields.push('Araç modeli');
        }
      } else {
        const hasIds = !!input.vehicle.motor_brand_id && !!input.vehicle.motor_model_id;
        const hasNames = !!brandName && !!modelName;
        if (!hasIds && !hasNames) {
          missingFields.push('Motor markası');
          missingFields.push('Motor modeli');
        }
      }
    }
    
    // Satış bilgileri kontrolü
    if (!input.sale) {
      missingFields.push('Satış bilgileri');
    } else {
      if (!input.sale.package_id) {
        missingFields.push('Paket');
      }
      if (!input.sale.price || input.sale.price <= 0) {
        missingFields.push('Satış fiyatı (0\'dan büyük olmalı)');
      }
    }
    
    // Ödeme bilgileri kontrolü
    if (!input.payment || !input.payment.type) {
      missingFields.push('Ödeme tipi');
    }
    
    // Eksik alan varsa hata fırlat
    if (missingFields.length > 0) {
      throw new AppError(400, `Eksik bilgiler: ${missingFields.join(', ')}. Lütfen tüm zorunlu alanları doldurun.`);
    }

    // Başlangıç/bitiş: tek kaynak (gönderilmezse bugün+7, end = start+1y)
    const policyDates = resolvePolicyDates(input.sale.start_date);
    input.sale.start_date = policyDates.start_date;
    input.sale.end_date = policyDates.end_date;
    
    // Transaction başlat - hata olursa tüm işlemler geri alınır
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. MÜŞTERI İŞLEMİ
      let customer: Customer;
      
      // Boş string'leri null'a çevir (MySQL için gerekli)
      // Özellikle birth_date boş string olarak gelirse null yapılmalı
      const sanitizeCustomerData = (data: any) => {
        return {
          ...data,
          surname: data.surname && data.surname.trim() !== '' ? data.surname : null,
          tax_office: data.tax_office && data.tax_office.trim() !== '' ? data.tax_office : null,
          birth_date: data.birth_date && data.birth_date.trim() !== '' ? data.birth_date : null,
          email: data.email && data.email.trim() !== '' ? data.email : null,
          city: data.city && data.city.trim() !== '' ? data.city : null,
          district: data.district && data.district.trim() !== '' ? data.district : null,
          address: data.address && data.address.trim() !== '' ? data.address : null,
        };
      };
      
      if (input.customer.id) {
        // Mevcut müşteri güncelle
        const existingCustomer = await queryRunner.manager.findOne(Customer, {
          where: { id: input.customer.id }
        });
        
        if (!existingCustomer) {
          throw new AppError(404, 'Müşteri bulunamadı');
        }
        
        // Müşteri bilgilerini güncelle (boş string'leri null'a çevir)
        const sanitizedData = sanitizeCustomerData(input.customer);
        Object.assign(existingCustomer, {
          is_corporate: sanitizedData.is_corporate,
          tc_vkn: sanitizedData.tc_vkn,
          name: sanitizedData.name,
          surname: sanitizedData.surname,
          tax_office: sanitizedData.tax_office,
          birth_date: sanitizedData.birth_date,
          phone: sanitizedData.phone,
          email: sanitizedData.email,
          city: sanitizedData.city,
          district: sanitizedData.district,
          address: sanitizedData.address,
        });

        // Eksik tenant alanlarını satış bağlamından doldur (liste filtresi için kritik)
        if (!existingCustomer.agency_id && input.agency_id) {
          existingCustomer.agency_id = input.agency_id;
        }
        if (!existingCustomer.branch_id && input.branch_id) {
          existingCustomer.branch_id = input.branch_id;
        }
        if (!existingCustomer.created_by && input.user_id) {
          existingCustomer.created_by = input.user_id;
        }
        
        customer = await queryRunner.manager.save(existingCustomer);
      } else {
        // Yeni müşteri oluştur (boş string'leri null'a çevir)
        const sanitizedData = sanitizeCustomerData(input.customer);
        const newCustomer = queryRunner.manager.create(Customer, {
          ...sanitizedData,
          agency_id: input.agency_id,
          branch_id: input.branch_id,
          created_by: input.user_id,
        });
        
        customer = await queryRunner.manager.save(newCustomer);
        console.log('📝 Customer created in transaction (will be rolled back for PayTR):', customer.id);
      }

      // 2. ARAÇ İŞLEMİ
      // Önce plakaya göre mevcut araç var mı kontrol et
      let vehicle = await queryRunner.manager.findOne(Vehicle, {
        where: { plate: input.vehicle.plate.toUpperCase() }
      });

      // Motosiklet mi otomobil mi kontrol et
      const isMotorcycle = input.vehicle.vehicle_type === 'Motosiklet';
      const resolvedBrandName = input.vehicle.brand_name?.trim() || null;
      const resolvedModelName = input.vehicle.model_name?.trim() || null;

      // Katalog ID varsa adları da senkronize et (tutarlı okuma)
      let syncBrandName = resolvedBrandName;
      let syncModelName = resolvedModelName;

      if (isMotorcycle && input.vehicle.motor_brand_id) {
        const motorBrand = await queryRunner.manager
          .createQueryBuilder()
          .select('b.name', 'name')
          .from('motor_brands', 'b')
          .where('b.id = :id', { id: input.vehicle.motor_brand_id })
          .getRawOne();
        if (motorBrand?.name) syncBrandName = syncBrandName || motorBrand.name;
      }
      if (isMotorcycle && input.vehicle.motor_model_id) {
        const motorModel = await queryRunner.manager
          .createQueryBuilder()
          .select('m.name', 'name')
          .from('motor_models', 'm')
          .where('m.id = :id', { id: input.vehicle.motor_model_id })
          .getRawOne();
        if (motorModel?.name) syncModelName = syncModelName || motorModel.name;
      }
      if (!isMotorcycle && input.vehicle.brand_id) {
        const carBrand = await queryRunner.manager
          .createQueryBuilder()
          .select('b.name', 'name')
          .from('cars_brands', 'b')
          .where('b.id = :id', { id: input.vehicle.brand_id })
          .getRawOne();
        if (carBrand?.name) syncBrandName = syncBrandName || carBrand.name;
      }
      if (!isMotorcycle && input.vehicle.model_id) {
        const carModel = await queryRunner.manager
          .createQueryBuilder()
          .select('m.name', 'name')
          .from('cars_models', 'm')
          .where('m.id = :id', { id: input.vehicle.model_id })
          .getRawOne();
        if (carModel?.name) syncModelName = syncModelName || carModel.name;
      }

      if (vehicle) {
        // Mevcut araç - bilgilerini güncelle
        const updateData: any = {
          customer_id: customer.id,
          vehicle_type: input.vehicle.vehicle_type,
          is_foreign_plate: input.vehicle.is_foreign_plate,
          registration_serial: input.vehicle.registration_serial?.toUpperCase() || null,
          registration_number: input.vehicle.registration_number || null,
          model_year: input.vehicle.model_year,
          usage_type: input.vehicle.usage_type,
          brand_name: syncBrandName,
          model_name: syncModelName,
        };

        // Motosiklet için motor_brand_id ve motor_model_id, otomobil için brand_id ve model_id kullan
        if (isMotorcycle) {
          updateData.motor_brand_id = input.vehicle.motor_brand_id || null;
          updateData.motor_model_id = input.vehicle.motor_model_id || null;
          updateData.brand_id = null; // Otomobil kolonlarını temizle
          updateData.model_id = null;
        } else {
          updateData.brand_id = input.vehicle.brand_id || null;
          updateData.model_id = input.vehicle.model_id || null;
          updateData.motor_brand_id = null; // Motosiklet kolonlarını temizle
          updateData.motor_model_id = null;
        }

        Object.assign(vehicle, updateData);
        vehicle = await queryRunner.manager.save(vehicle);
      } else {
        // Yeni araç oluştur
        const vehicleData: any = {
          customer_id: customer.id,
          agency_id: input.agency_id || undefined,  // null yerine undefined kullan
          branch_id: input.branch_id || undefined,
          vehicle_type: input.vehicle.vehicle_type,
          is_foreign_plate: input.vehicle.is_foreign_plate,
          plate: input.vehicle.plate.toUpperCase(),
          registration_serial: input.vehicle.registration_serial?.toUpperCase() || undefined,
          registration_number: input.vehicle.registration_number || undefined,
          model_year: input.vehicle.model_year,
          usage_type: input.vehicle.usage_type as UsageType,  // string'i enum'a cast et
          brand_name: syncBrandName || undefined,
          model_name: syncModelName || undefined,
        };

        // Motosiklet için motor_brand_id ve motor_model_id, otomobil için brand_id ve model_id kullan
        if (isMotorcycle) {
          vehicleData.motor_brand_id = input.vehicle.motor_brand_id || undefined;
          vehicleData.motor_model_id = input.vehicle.motor_model_id || undefined;
        } else {
          vehicleData.brand_id = input.vehicle.brand_id || undefined;
          vehicleData.model_id = input.vehicle.model_id || undefined;
        }

        const newVehicle = queryRunner.manager.create(Vehicle, vehicleData);
        vehicle = await queryRunner.manager.save(newVehicle);
      }

      // Komisyon hesaplamaları
      // Bakiye ile ödemede komisyon KESİLMEZ: satış kaydedilir, commission/branch_commission/agency_commission 0 olur,
      // bakiyeye komisyon eklenmez (sadece satış tutarı bakiyeden düşülür).
      let branchCommission: number | null = null;
      let agencyCommission: number | null = null;
      let totalCommission: number = 0;

      if (input.payment.type === PaymentType.BALANCE) {
        // Bakiye ile ödemede komisyon kesilmez – hepsi 0
        branchCommission = null;
        agencyCommission = null;
        totalCommission = 0;
      } else if (input.branch_id) {
        // Şube satışında her zaman backend’de dağılımlı komisyon hesaplanır:
        // Şube kendi oranını (branch_commission), acente kendi payını (agency_commission) alır.
        // Frontend’den gelen commission kullanılmaz.
        const distributedCommission = await this.calculateDistributedCommission(
          Number(input.sale.price),
          input.branch_id,
          input.agency_id || null
        );
        branchCommission = distributedCommission.branch_commission;
        agencyCommission = distributedCommission.agency_commission;
        totalCommission = distributedCommission.total_commission;
      } else if (input.sale.commission === undefined) {
        // Acente satışı (şube yok), komisyon hesaplanmamışsa hesapla
        const distributedCommission = await this.calculateDistributedCommission(
          Number(input.sale.price),
          null,
          input.agency_id || null
        );
        branchCommission = distributedCommission.branch_commission;
        agencyCommission = distributedCommission.agency_commission;
        totalCommission = distributedCommission.total_commission;
      } else {
        // Sadece acente satışı ve frontend komisyon göndermişse kullan (şube yok)
        totalCommission = input.sale.commission;
        agencyCommission = input.sale.commission;
        branchCommission = null;
      }

      // 4. ÖDEME İŞLEMİ - PayTR için önce kontrol et, hiçbir kayıt oluşturma
      if (input.payment.type === PaymentType.PAYTR) {
        // PayTR için hiçbir kayıt oluşturulmamalı - önce ödeme yapılmalı
        console.log('⚠️ PayTR payment detected - rolling back transaction to prevent premature record creation');
        console.log('Customer ID before rollback:', customer.id);
        console.log('Vehicle ID before rollback:', vehicle.id);
        
        // Transaction'ı rollback et (müşteri ve araç kaydedilmemeli)
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        
        console.log('✅ Transaction rolled back - no customer, vehicle, or sale records created');
        
        // Geçici bir merchant_oid oluştur (PayTR için)
        const tempMerchantOid = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // PayTR için sanitize edilmiş versiyonu da sakla
        const sanitizedMerchantOid = tempMerchantOid.replace(/[^a-zA-Z0-9]/g, '');
        
        // Tüm bilgileri payment_details'te sakla (müşteri, araç, satış bilgileri)
        const saleData = {
          // Müşteri bilgileri (ID değil, tüm bilgiler)
          customer: {
            is_corporate: input.customer.is_corporate,
            tc_vkn: input.customer.tc_vkn,
            name: input.customer.name,
            surname: input.customer.surname,
            tax_office: input.customer.tax_office,
            birth_date: input.customer.birth_date,
            phone: input.customer.phone,
            email: input.customer.email,
            city: input.customer.city,
            district: input.customer.district,
            address: input.customer.address,
          },
          // Araç bilgileri (ID değil, tüm bilgiler)
          vehicle: {
            vehicle_type: input.vehicle.vehicle_type,
            is_foreign_plate: input.vehicle.is_foreign_plate,
            plate: input.vehicle.plate,
            registration_serial: input.vehicle.registration_serial,
            registration_number: input.vehicle.registration_number,
            brand_id: input.vehicle.brand_id,
            model_id: input.vehicle.model_id,
            motor_brand_id: input.vehicle.motor_brand_id,
            motor_model_id: input.vehicle.motor_model_id,
            brand_name: input.vehicle.brand_name,
            model_name: input.vehicle.model_name,
            model_year: input.vehicle.model_year,
            usage_type: input.vehicle.usage_type,
          },
          // Satış bilgileri
          sale: {
            package_id: input.sale.package_id,
            price: input.sale.price,
            start_date: input.sale.start_date,
            end_date: input.sale.end_date,
            commission: totalCommission,
            branch_commission: branchCommission,
            agency_commission: agencyCommission,
          },
          // Diğer bilgiler
          agency_id: input.agency_id,
          branch_id: input.branch_id,
          user_id: input.user_id,
        };
        
        // Payment kaydı oluştur (hiçbir ilişkili kayıt olmadan)
        // transaction_id'yi sanitize edilmiş merchant_oid ile oluştur (frontend'den gelen ID ile eşleşmesi için)
        const payment = this.paymentRepository.create({
          sale_id: null, // Satış henüz yok, callback'te gerçek sale_id ile güncellenecek
          agency_id: input.agency_id || undefined,
          amount: input.sale.price,
          type: PaymentType.PAYTR,
          status: PaymentStatus.PENDING,
          transaction_id: `PAYTR_PENDING_${sanitizedMerchantOid}_${Date.now()}`,
          payment_details: {
            payment_initiated_at: new Date().toISOString(),
            sale_data: saleData, // Tüm bilgileri sakla
            temp_merchant_oid: tempMerchantOid, // Orijinal format
            sanitized_merchant_oid: sanitizedMerchantOid, // PayTR'ye gönderilen format
            note: 'All records will be created after successful payment',
          },
        });
        
        await this.paymentRepository.save(payment);
        
        // Token almak için gerekli bilgileri döndür
        return {
          temp_merchant_oid: sanitizedMerchantOid, // Frontend'e sanitize edilmiş versiyonu gönder
          payment_id: payment.id,
          package_id: input.sale.package_id,
          price: input.sale.price,
          start_date: input.sale.start_date,
          end_date: input.sale.end_date,
          agency_id: input.agency_id,
          branch_id: input.branch_id,
          user_id: input.user_id,
          payment_type: PaymentType.PAYTR,
        } as any;
      }

      // PayTR değilse, normal satış işlemini devam ettir
      // 3. SATIŞ İŞLEMİ
      // Paketi kontrol et
      const pkg = await queryRunner.manager.findOne(Package, {
        where: { id: input.sale.package_id }
      });
      
      if (!pkg) {
        throw new AppError(404, 'Paket bulunamadı');
      }

      // Satış numarası oluştur (eğer gönderilmemişse)
      const policyNumber = this.generatePolicyNumber();

      // Satış oluştur
      const newSale = queryRunner.manager.create(Sale, {
        customer_id: customer.id,
        vehicle_id: vehicle.id,
        agency_id: input.agency_id,
        branch_id: input.branch_id,
        user_id: input.user_id,
        package_id: input.sale.package_id,
        price: input.sale.price,
        commission: totalCommission,
        branch_commission: branchCommission,
        agency_commission: agencyCommission,
        start_date: input.sale.start_date,
        end_date: input.sale.end_date,
        policy_number: policyNumber,
      });
      
      const sale = await queryRunner.manager.save(newSale);
      console.log('✅ Sale created (non-PayTR payment):', sale.id);

      // 3.5. BAKİYE GÜNCELLEMELERİ (sadece bakiye ile ödeme DEĞİLSE)
      // Bakiye ile ödemede komisyon bakiyeye eklenmez; sadece satış tutarı bakiyeden düşülür
      if (input.payment.type !== PaymentType.BALANCE) {
        // Şube varsa: Şube bakiyesine branch_commission ekle
        if (input.branch_id && branchCommission !== null && branchCommission > 0) {
          const branch = await queryRunner.manager.findOne(Branch, {
            where: { id: input.branch_id }
          });
          if (branch) {
            const currentBalance = parseFloat(branch.balance?.toString() || '0') || 0;
            branch.balance = currentBalance + branchCommission;
            await queryRunner.manager.save(branch);
          }
        }

        // Acente varsa: Acente bakiyesine agency_commission ekle
        if (input.agency_id && agencyCommission !== null && agencyCommission > 0) {
          const agency = await queryRunner.manager.findOne(Agency, {
            where: { id: input.agency_id }
          });
          if (agency) {
            const currentBalance = parseFloat(agency.balance?.toString() || '0') || 0;
            agency.balance = currentBalance + agencyCommission;
            await queryRunner.manager.save(agency);
          }
        }
      }

      // 4. ÖDEME İŞLEMİ (Bakiye ödemesi)
      // Şube kullanıcısı ise şube bakiyesinden, acente kullanıcısı ise acente bakiyesinden düş
      let payment: Payment;

        if (!input.agency_id) {
          throw new AppError(400, 'Bakiye ödemesi için acente gerekli');
        }

        const paymentAmount = parseFloat(input.sale.price?.toString() || '0') || 0;

        if (input.branch_id) {
          // Şube kullanıcısı: şube bakiyesinden düş
          const branch = await queryRunner.manager.findOne(Branch, {
            where: { id: input.branch_id }
          });
          if (!branch) {
            throw new AppError(404, 'Şube bulunamadı');
          }
          const currentBalance = parseFloat(branch.balance?.toString() || '0') || 0;
          if (currentBalance < paymentAmount) {
            throw new AppError(400, `Yetersiz şube bakiyesi. Mevcut: ${currentBalance.toFixed(2)} TL, Gerekli: ${paymentAmount.toFixed(2)} TL`);
          }
          branch.balance = currentBalance - paymentAmount;
          await queryRunner.manager.save(branch);
        } else {
          // Acente kullanıcısı (şube yok): acente bakiyesinden düş
          const agency = await queryRunner.manager.findOne(Agency, {
            where: { id: input.agency_id }
          });
          if (!agency) {
            throw new AppError(404, 'Acente bulunamadı');
          }
          const currentBalance = parseFloat(agency.balance?.toString() || '0') || 0;
          if (currentBalance < paymentAmount) {
            throw new AppError(400, `Yetersiz bakiye. Mevcut: ${currentBalance.toFixed(2)} TL, Gerekli: ${paymentAmount.toFixed(2)} TL`);
          }
          agency.balance = currentBalance - paymentAmount;
          await queryRunner.manager.save(agency);
        }

        payment = queryRunner.manager.create(Payment, {
          sale_id: sale.id,
          agency_id: input.agency_id,
          amount: paymentAmount,
          type: PaymentType.BALANCE,
          status: PaymentStatus.COMPLETED,
          transaction_id: 'BALANCE_' + Date.now(),
          payment_details: {
            deducted_from_balance: paymentAmount,
            payment_date: new Date().toISOString(),
          },
        });

      await queryRunner.manager.save(payment);

      // Transaction başarılı - commit et
      await queryRunner.commitTransaction();

      // SMS gönderme işlemi (hata durumunda ana işlemi etkilememeli)
      if (customer.phone) {
        try {
          const smsService = new SmsService();
          // Tarih formatlama için helper fonksiyon
          const formatDate = (dateString: string) => {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
          };
          
          const customerName = `${customer.name}${customer.surname ? ' ' + customer.surname : ''}`;
          const packageName = pkg.name;
          const startDate = formatDate(input.sale.start_date);
          const endDate = formatDate(input.sale.end_date);
          
          // PDF linkini oluştur (temiz URL - frontend route)
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const pdfUrl = `${frontendUrl}/pdf/sale/${sale.id}`;
          
          const smsMessage = `Sayın ${customerName}, ${packageName} paketiniz başarıyla oluşturuldu. Satış No: ${policyNumber}, Başlangıç: ${startDate}, Bitiş: ${endDate}. Sözleşme: ${pdfUrl} 7/24 Destek: 0850 304 54 40`;
          await smsService.sendSingleSms(customer.phone, smsMessage);
        } catch (error: any) {
          // SMS gönderme hatası ana işlemi etkilememeli, sadece log yaz
          console.error('SMS gönderme hatası (satış tamamlama):', error.message);
        }
      }

      // Satışı ilişkileriyle birlikte döndür
      return await this.getById(sale.id);

    } catch (error) {
      // Hata oluştu - tüm işlemleri geri al
      // Sadece transaction başlatılmışsa rollback et
      if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      // QueryRunner'ı serbest bırak (sadece release edilmemişse)
      if (queryRunner.isReleased === false) {
      await queryRunner.release();
      }
    }
  }

  // ===== İADE İŞLEMLERİ =====

  /**
   * İade tutarını hesaplar
   * Formül:
   * 1. Toplam fiyattan KDV'yi çıkar (net fiyat = fiyat / 1.20)
   * 2. Net fiyatı 365 güne böl (günlük ücret)
   * 3. Kalan günleri hesapla (bitiş tarihi - bugün)
   * 4. Günlük ücret × kalan gün = iade tutarı
   * 
   * @param saleId - Satış ID'si
   * @returns İade hesaplama detayları
   */
  async calculateRefund(saleId: string) {
    // Satışı bul
    const sale = await this.saleRepository.findOne({
      where: { id: saleId },
      relations: ['customer', 'vehicle', 'package']
    });

    if (!sale) {
      throw new AppError(404, 'Satış bulunamadı');
    }

    // Zaten iade edilmiş mi kontrol et
    if (sale.is_refunded) {
      throw new AppError(400, 'Bu satış zaten iade edilmiş');
    }

    // Tarih hesaplamaları
    const today = new Date();
    const startDate = new Date(sale.start_date);
    const endDate = new Date(sale.end_date);

    // Sözleşme süresi dolmuş mu?
    if (today > endDate) {
      throw new AppError(400, 'Sözleşme süresi dolmuş, iade yapılamaz');
    }

    // KDV oranı (%20)
    const KDV_RATE = 0.20;
    
    // Toplam fiyat (KDV dahil)
    const totalPrice = parseFloat(sale.price.toString());
    
    // Net fiyat (KDV hariç) = Toplam / 1.20
    const netPrice = totalPrice / (1 + KDV_RATE);
    
    // Sözleşme süresi (gün) - genelde 365 gün
    const contractDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Günlük ücret (net)
    const dailyRate = netPrice / contractDays;
    
    // Kullanılan gün sayısı
    const usedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Kalan gün sayısı
    const remainingDays = Math.max(0, contractDays - usedDays);
    
    // İade tutarı = günlük ücret × kalan gün
    const refundAmount = dailyRate * remainingDays;
    
    // KDV tutarı (sadece bilgi için)
    const kdvAmount = totalPrice - netPrice;

    return {
      sale: {
        id: sale.id,
        customer_name: sale.customer?.name + ' ' + (sale.customer?.surname || ''),
        vehicle_plate: sale.vehicle?.plate,
        package_name: sale.package?.name,
        total_price: totalPrice,
        start_date: sale.start_date,
        end_date: sale.end_date
      },
      calculation: {
        total_price: Number(totalPrice.toFixed(2)),           // KDV dahil toplam
        kdv_amount: Number(kdvAmount.toFixed(2)),             // KDV tutarı
        net_price: Number(netPrice.toFixed(2)),               // KDV hariç net
        contract_days: contractDays,                          // Toplam sözleşme günü
        used_days: usedDays,                                  // Kullanılan gün
        remaining_days: remainingDays,                        // Kalan gün
        daily_rate: Number(dailyRate.toFixed(2)),             // Günlük ücret
        refund_amount: Number(refundAmount.toFixed(2))        // İade tutarı
      }
    };
  }

  /**
   * İade işlemini gerçekleştirir
   * 
   * @param saleId - Satış ID'si
   * @param reason - İade sebebi
   * @param userId - İşlemi yapan kullanıcı ID'si
   * @returns Güncellenmiş satış kaydı
   */
  async processRefund(saleId: string, reason: string, userId: string) {
    // Transaction başlat
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Satışı bul
      const sale = await queryRunner.manager.findOne(Sale, {
        where: { id: saleId },
        relations: ['customer', 'vehicle', 'package', 'agency']
      });

      if (!sale) {
        throw new AppError(404, 'Satış bulunamadı');
      }

      // Zaten iade edilmiş mi?
      if (sale.is_refunded) {
        throw new AppError(400, 'Bu satış zaten iade edilmiş');
      }

      // İade tutarını hesapla
      const refundCalc = await this.calculateRefund(saleId);
      const refundAmount = refundCalc.calculation.refund_amount;

      // Satışı güncelle - iade bilgilerini ekle
      sale.is_refunded = true;
      sale.refunded_at = new Date();
      sale.refund_amount = refundAmount;
      sale.refund_reason = reason;
      sale.refunded_by = userId;

      await queryRunner.manager.save(sale);

      // Eğer bakiyeden ödeme yapılmışsa, iade tutarını doğru bakiyeye geri ekle (şube satışıysa şube, acente satışıysa acente)
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { sale_id: saleId }
      });

      if (payment && payment.type === PaymentType.BALANCE && sale.agency_id) {
        if (sale.branch_id) {
          const branch = await queryRunner.manager.findOne(Branch, {
            where: { id: sale.branch_id }
          });
          if (branch) {
            const currentBalance = parseFloat(branch.balance?.toString() || '0') || 0;
            branch.balance = currentBalance + refundAmount;
            await queryRunner.manager.save(branch);
          }
        } else {
          const agency = await queryRunner.manager.findOne(Agency, {
            where: { id: sale.agency_id }
          });
          if (agency) {
            const currentBalance = parseFloat(agency.balance?.toString() || '0') || 0;
            agency.balance = currentBalance + refundAmount;
            await queryRunner.manager.save(agency);
          }
        }
      }

      // Ödeme kaydını REFUNDED olarak güncelle
      if (payment) {
        payment.status = PaymentStatus.REFUNDED;
        payment.payment_details = {
          ...payment.payment_details,
          refund_date: new Date().toISOString(),
          refund_amount: refundAmount,
          refund_reason: reason
        };
        await queryRunner.manager.save(payment);
      }

      // Transaction commit
      await queryRunner.commitTransaction();

      // Güncel satış bilgisini döndür
      return await this.getById(saleId);

    } catch (error) {
      // Hata olursa rollback
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Satış istatistikleri
  async getStats(filter?: any) {
    const queryBuilder = this.saleRepository.createQueryBuilder('sale');

    if (filter) {
      // Sale entity'sinde 'created_by' yerine 'user_id' kolonu var
      applyTenantFilter(queryBuilder, filter, 'sale', 'user_id');
    }

    const totalSales = await queryBuilder.getCount();

    const totalRevenue = await queryBuilder
      .clone()
      .select('SUM(sale.price)', 'total')
      .getRawOne();

    const totalCommission = await queryBuilder
      .clone()
      .select('SUM(sale.commission)', 'total')
      .getRawOne();

    // Aylık satış verilerini tenant filter ile getir
    const monthlySalesQb = this.saleRepository.createQueryBuilder('sale');
    if (filter) {
      applyTenantFilter(monthlySalesQb, filter, 'sale', 'user_id');
    }

    const monthlySales = await monthlySalesQb
      .select('DATE_FORMAT(sale.created_at, "%Y-%m") as month')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.price)', 'revenue')
      .groupBy('month')
      .orderBy('month', 'DESC')
      .limit(12)
      .getRawMany();

    return {
      totalSales,
      totalRevenue: parseFloat(totalRevenue?.total || '0'),
      totalCommission: parseFloat(totalCommission?.total || '0'),
      monthlySales,
    };
  }
}

import { AppDataSource } from '../config/database';
import { Sale } from '../entities/Sale';
import { Branch } from '../entities/Branch';
import { Agency } from '../entities/Agency';
import { Customer } from '../entities/Customer';
import { Vehicle } from '../entities/Vehicle';
import { Payment } from '../entities/Payment';
import { Package } from '../entities/Package';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { PaymentType, PaymentStatus, UsageType, UserRole } from '../types/enums';
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
    model_year: number;
    usage_type: string;
  };
  // Satış bilgileri
  sale: {
    package_id: string;
    start_date: string;
    end_date: string;
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
  private vehicleService = new VehicleService();

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

  // Satışları listele (tenant filter ile)
  async getAll(filter?: any, search?: string, userRole?: string) {
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
      // Sale entity'sinde 'created_by' yerine 'user_id' kolonu var
      applyTenantFilter(queryBuilder, filter, 'sale', 'user_id');
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
      throw new AppError(404, 'Sale not found');
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
   * Komisyon tutarını hesaplar
   * @param price - Satış fiyatı
   * @param commissionRate - Komisyon oranı (%)
   * @returns Komisyon tutarı (TL)
   */
  calculateCommission(price: number, commissionRate: number): number {
    return (price * commissionRate) / 100;
  }

  /**
   * Dağılımlı komisyon hesaplar
   * Şube varsa: Şube kendi komisyonunu alır, kalan kısım (acente komisyonu - şube komisyonu) acenteye gider
   * Şube yoksa: Sadece acente komisyonu
   * @param price - Satış fiyatı
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

      // Şube komisyonu = price × branch_rate / 100
      const branchCommission = (price * branchRate) / 100;

      // Acente komisyonu = price × (agency_rate - branch_rate) / 100
      const agencyCommission = (price * (agencyRate - branchRate)) / 100;

      // Toplam = price × agency_rate / 100
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

    // 3. İkisi de yoksa: Varsayılan %20
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
      throw new AppError(404, 'Sale not found');
    }

    Object.assign(sale, data);
    await this.saleRepository.save(sale);
    return sale;
  }

  // Satış sil
  async delete(id: string) {
    const sale = await this.saleRepository.findOne({ where: { id } });

    if (!sale) {
      throw new AppError(404, 'Sale not found');
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
      }

      // 2. ARAÇ İŞLEMİ
      // Önce plakaya göre mevcut araç var mı kontrol et
      let vehicle = await queryRunner.manager.findOne(Vehicle, {
        where: { plate: input.vehicle.plate.toUpperCase() }
      });

      // Motosiklet mi otomobil mi kontrol et
      const isMotorcycle = input.vehicle.vehicle_type === 'Motosiklet';

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

      // 3. SATIŞ İŞLEMİ
      // Paketi kontrol et
      const pkg = await queryRunner.manager.findOne(Package, {
        where: { id: input.sale.package_id }
      });
      
      if (!pkg) {
        throw new AppError(404, 'Paket bulunamadı');
      }

      // Dağılımlı komisyon hesapla (eğer gönderilmemişse)
      let branchCommission: number | null = null;
      let agencyCommission: number | null = null;
      let totalCommission: number = 0;

      if (input.sale.commission === undefined) {
        const distributedCommission = await this.calculateDistributedCommission(
          Number(input.sale.price),
          input.branch_id || null,
          input.agency_id || null
        );
        branchCommission = distributedCommission.branch_commission;
        agencyCommission = distributedCommission.agency_commission;
        totalCommission = distributedCommission.total_commission;
      } else {
        // Manuel komisyon gönderilmişse, eski mantıkla toplam komisyonu kullan
        totalCommission = input.sale.commission;
        // Manuel durumda dağılımlı komisyon hesapla (gösterim için)
        try {
          const distributedCommission = await this.calculateDistributedCommission(
            Number(input.sale.price),
            input.branch_id || null,
            input.agency_id || null
          );
          branchCommission = distributedCommission.branch_commission;
          agencyCommission = distributedCommission.agency_commission;
        } catch (error) {
          // Hata durumunda null bırak
          branchCommission = null;
          agencyCommission = null;
        }
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

      // 3.5. BAKİYE GÜNCELLEMELERİ
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

      // 4. ÖDEME İŞLEMİ
      let payment: Payment;

      if (input.payment.type === PaymentType.PAYTR) {
        // PayTR ödemesi - asenkron çalışır
        // Token alma işlemi ayrı bir endpoint'te yapılır
        // Burada sadece pending durumda payment kaydı oluşturulur
        // Callback'te güncellenecek
        
        payment = queryRunner.manager.create(Payment, {
          sale_id: sale.id,
          agency_id: input.agency_id || undefined,  // null yerine undefined kullan
          amount: input.sale.price,
          type: PaymentType.PAYTR,
          status: PaymentStatus.PENDING, // Callback'te COMPLETED veya FAILED olacak
          transaction_id: 'PAYTR_PENDING_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
          payment_details: {
            payment_initiated_at: new Date().toISOString(),
            note: 'Payment will be processed via PayTR callback',
          },
        });
      } else {
        // Bakiye ödemesi
        if (!input.agency_id) {
          throw new AppError(400, 'Bakiye ödemesi için acente gerekli');
        }

        const agency = await queryRunner.manager.findOne(Agency, {
          where: { id: input.agency_id }
        });

        if (!agency) {
          throw new AppError(404, 'Acente bulunamadı');
        }

        const currentBalance = parseFloat(agency.balance?.toString() || '0') || 0;
        const paymentAmount = parseFloat(input.sale.price?.toString() || '0') || 0;

        if (currentBalance < paymentAmount) {
          throw new AppError(400, `Yetersiz bakiye. Mevcut: ${currentBalance.toFixed(2)} TL, Gerekli: ${paymentAmount.toFixed(2)} TL`);
        }

        // Bakiyeden düş
        agency.balance = currentBalance - paymentAmount;
        await queryRunner.manager.save(agency);

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
      }

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
          
          const smsMessage = `Sayın ${customerName}, ${packageName} paketiniz başarıyla oluşturuldu. Satış No: ${policyNumber}, Başlangıç: ${startDate}, Bitiş: ${endDate}. 7/24 Destek: 0850 304 54 40`;
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
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // QueryRunner'ı serbest bırak
      await queryRunner.release();
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

      // Eğer bakiyeden ödeme yapılmışsa, iade tutarını bakiyeye geri ekle
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { sale_id: saleId }
      });

      if (payment && payment.type === PaymentType.BALANCE && sale.agency_id) {
        // Acentenin bakiyesine iade tutarını ekle
        const agency = await queryRunner.manager.findOne(Agency, {
          where: { id: sale.agency_id }
        });

        if (agency) {
          const currentBalance = parseFloat(agency.balance?.toString() || '0');
          agency.balance = currentBalance + refundAmount;
          await queryRunner.manager.save(agency);
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

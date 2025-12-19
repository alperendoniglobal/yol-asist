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
import { PaymentType, PaymentStatus, UsageType } from '../types/enums';

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
    is_foreign_plate: boolean;
    plate: string;
    registration_serial?: string;
    registration_number?: string;
    brand_id: number;
    model_id: number;
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

  // Satışları listele (tenant filter ile)
  async getAll(filter?: any) {
    const queryBuilder = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.vehicle', 'vehicle')
      .leftJoinAndSelect('sale.package', 'package')
      .leftJoinAndSelect('sale.agency', 'agency')
      .leftJoinAndSelect('sale.branch', 'branch')
      .leftJoinAndSelect('sale.user', 'user')
      .orderBy('sale.created_at', 'DESC');

    if (filter) {
      // Sale entity'sinde 'created_by' yerine 'user_id' kolonu var
      applyTenantFilter(queryBuilder, filter, 'sale', 'user_id');
    }

    const sales = await queryBuilder.getMany();
    return sales;
  }

  // ID ile satış getir
  async getById(id: string) {
    const sale = await this.saleRepository.findOne({
      where: { id },
      relations: ['customer', 'vehicle', 'package', 'agency', 'branch', 'user', 'payments'],
    });

    if (!sale) {
      throw new AppError(404, 'Sale not found');
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

  // Yeni satış oluştur
  async create(data: Partial<Sale>) {
    // Komisyon otomatik hesaplanmamışsa hesapla
    // Şube veya acente olmasa bile komisyon hesaplanabilir (varsayılan %20)
    if (data.commission === undefined && data.price) {
      const commissionRate = await this.getCommissionRate(data.branch_id || null, data.agency_id || null);
      data.commission = this.calculateCommission(Number(data.price), commissionRate);
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
      
      if (input.customer.id) {
        // Mevcut müşteri güncelle
        const existingCustomer = await queryRunner.manager.findOne(Customer, {
          where: { id: input.customer.id }
        });
        
        if (!existingCustomer) {
          throw new AppError(404, 'Müşteri bulunamadı');
        }
        
        // Müşteri bilgilerini güncelle
        Object.assign(existingCustomer, {
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
        });
        
        customer = await queryRunner.manager.save(existingCustomer);
      } else {
        // Yeni müşteri oluştur
        const newCustomer = queryRunner.manager.create(Customer, {
          ...input.customer,
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

      if (vehicle) {
        // Mevcut araç - bilgilerini güncelle
        Object.assign(vehicle, {
          customer_id: customer.id,
          is_foreign_plate: input.vehicle.is_foreign_plate,
          registration_serial: input.vehicle.registration_serial?.toUpperCase() || null,
          registration_number: input.vehicle.registration_number || null,
          brand_id: input.vehicle.brand_id,
          model_id: input.vehicle.model_id,
          model_year: input.vehicle.model_year,
          usage_type: input.vehicle.usage_type,
        });
        vehicle = await queryRunner.manager.save(vehicle);
      } else {
        // Yeni araç oluştur
        const newVehicle = queryRunner.manager.create(Vehicle, {
          customer_id: customer.id,
          agency_id: input.agency_id || undefined,  // null yerine undefined kullan
          branch_id: input.branch_id || undefined,
          is_foreign_plate: input.vehicle.is_foreign_plate,
          plate: input.vehicle.plate.toUpperCase(),
          registration_serial: input.vehicle.registration_serial?.toUpperCase() || undefined,
          registration_number: input.vehicle.registration_number || undefined,
          brand_id: input.vehicle.brand_id,
          model_id: input.vehicle.model_id,
          model_year: input.vehicle.model_year,
          usage_type: input.vehicle.usage_type as UsageType,  // string'i enum'a cast et
        });
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

      // Komisyon hesapla (eğer gönderilmemişse)
      // Şube veya acente olmasa bile komisyon hesaplanabilir (varsayılan %20)
      let commission = input.sale.commission;
      if (commission === undefined) {
        const commissionRate = await this.getCommissionRate(input.branch_id || null, input.agency_id || null);
        commission = this.calculateCommission(Number(input.sale.price), commissionRate);
      }

      // Satış oluştur
      const newSale = queryRunner.manager.create(Sale, {
        customer_id: customer.id,
        vehicle_id: vehicle.id,
        agency_id: input.agency_id,
        branch_id: input.branch_id,
        user_id: input.user_id,
        package_id: input.sale.package_id,
        price: input.sale.price,
        commission: commission || 0,
        start_date: input.sale.start_date,
        end_date: input.sale.end_date,
      });
      
      const sale = await queryRunner.manager.save(newSale);

      // 4. ÖDEME İŞLEMİ
      let payment: Payment;

      if (input.payment.type === PaymentType.IYZICO) {
        // Kredi kartı ödemesi (şimdilik simüle ediyoruz)
        // Gerçek uygulamada burada iyzico API çağrısı yapılır
        // Hata olursa exception fırlatılır ve transaction geri alınır
        
        payment = queryRunner.manager.create(Payment, {
          sale_id: sale.id,
          agency_id: input.agency_id || undefined,  // null yerine undefined kullan
          amount: input.sale.price,
          type: PaymentType.IYZICO,
          status: PaymentStatus.COMPLETED,
          transaction_id: 'IYZICO_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
          payment_details: {
            card_holder: input.payment.cardDetails?.cardHolderName,
            card_last_four: input.payment.cardDetails?.cardNumber?.slice(-4),
            payment_date: new Date().toISOString(),
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

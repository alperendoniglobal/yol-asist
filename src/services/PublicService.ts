import { AppDataSource } from '../config/database';
import { Package } from '../entities/Package';
import { PackageCover } from '../entities/PackageCover';
import { Customer } from '../entities/Customer';
import { Vehicle } from '../entities/Vehicle';
import { Sale } from '../entities/Sale';
import { Payment } from '../entities/Payment';
import { CarBrand } from '../entities/CarBrand';
import { CarModel } from '../entities/CarModel';
import { MotorBrand } from '../entities/MotorBrand';
import { MotorModel } from '../entities/MotorModel';
import { User } from '../entities/User';
import { DealerApplication } from '../entities/DealerApplication';
import { AppError } from '../middlewares/errorHandler';
import { EntityStatus, PaymentType, PaymentStatus, UsageType } from '../types/enums';
import { IyzicoService } from './IyzicoService';

/**
 * Public API Servisi
 * Giriş yapmadan erişilebilen public endpoint'ler için servis
 * Paketler (fiyatsız), hizmetler, kullanıcı satın alma işlemleri
 */
export class PublicService {
  private packageRepository = AppDataSource.getRepository(Package);
  private coverRepository = AppDataSource.getRepository(PackageCover);
  private customerRepository = AppDataSource.getRepository(Customer);
  private vehicleRepository = AppDataSource.getRepository(Vehicle);
  private saleRepository = AppDataSource.getRepository(Sale);
  private paymentRepository = AppDataSource.getRepository(Payment);
  private carBrandRepository = AppDataSource.getRepository(CarBrand);
  private carModelRepository = AppDataSource.getRepository(CarModel);
  private motorBrandRepository = AppDataSource.getRepository(MotorBrand);
  private motorModelRepository = AppDataSource.getRepository(MotorModel);
  private userRepository = AppDataSource.getRepository(User);
  private dealerApplicationRepository = AppDataSource.getRepository(DealerApplication);
  private iyzicoService = new IyzicoService();

  /**
   * TC Kimlik No kontrolü - Satın alma için
   * Customers tablosunda bu TC ile kayıtlı müşteri var mı?
   * Satın alma yapabilmek için TC'nin sistemde kayıtlı olması GEREKLİ
   */
  async checkTcExists(tc_vkn: string): Promise<{ exists: boolean; message: string; customer?: { name: string; surname: string } }> {
    // TC'yi temizle (sadece rakamlar)
    const cleanTc = tc_vkn.replace(/\D/g, '');

    // Customers tablosunda TC/VKN kontrolü - satın alma için bu zorunlu
    const existingCustomer = await this.customerRepository.findOne({ 
      where: { tc_vkn: cleanTc } 
    });

    if (existingCustomer) {
      // TC kayıtlı - satın alma yapabilir
      return {
        exists: true,
        message: 'T.C. Kimlik No doğrulandı. Devam edebilirsiniz.',
        customer: {
          name: existingCustomer.name,
          surname: existingCustomer.surname || '',
        },
      };
    }

    // TC kayıtlı değil - önce kayıt olması lazım
    return {
      exists: false,
      message: 'Bu T.C. Kimlik No ile sistemde kayıt bulunamadı. Satın alma yapabilmek için önce üye olmanız gerekmektedir.',
    };
  }

  /**
   * Tüm aktif paketleri fiyatsız olarak getir
   * Public sayfa için - fiyatlar gizli
   */
  async getPackagesWithoutPrice() {
    const packages = await this.packageRepository.find({
      where: { status: EntityStatus.ACTIVE },
      order: { vehicle_type: 'ASC', name: 'ASC' },
    });

    // Her paket için covers'ları al ve fiyatı çıkar
    const packagesWithCovers = await Promise.all(
      packages.map(async (pkg) => {
        const covers = await this.coverRepository.find({
          where: { package_id: pkg.id },
          order: { sort_order: 'ASC' },
        });

        // Fiyatsız paket verisi döndür
        return {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          vehicle_type: pkg.vehicle_type,
          max_vehicle_age: pkg.max_vehicle_age,
          covers: covers.map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description,
            usage_count: c.usage_count,
            // limit_amount gizli - sadece başlık ve kullanım sayısı
          })),
        };
      }),
    );

    return packagesWithCovers;
  }

  /**
   * Tek bir paketi fiyatsız olarak getir
   */
  async getPackageByIdWithoutPrice(id: string) {
    const pkg = await this.packageRepository.findOne({
      where: { id, status: EntityStatus.ACTIVE },
    });

    if (!pkg) {
      throw new AppError(404, 'Paket bulunamadı');
    }

    const covers = await this.coverRepository.find({
      where: { package_id: id },
      order: { sort_order: 'ASC' },
    });

    return {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      vehicle_type: pkg.vehicle_type,
      max_vehicle_age: pkg.max_vehicle_age,
      covers: covers.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        usage_count: c.usage_count,
      })),
    };
  }

  /**
   * Tüm unique hizmet başlıklarını getir (footer için)
   * Package covers'dan benzersiz title'ları döndür
   */
  async getUniqueServices() {
    const covers = await this.coverRepository
      .createQueryBuilder('cover')
      .select('DISTINCT cover.title', 'title')
      .orderBy('cover.title', 'ASC')
      .getRawMany();

    return covers.map((c) => c.title);
  }

  /**
   * Araba markalarını getir (public)
   */
  async getCarBrands() {
    return this.carBrandRepository.find({
      order: { name: 'ASC' },
    });
  }

  /**
   * Araba modellerini getir (public)
   */
  async getCarModels(brandId: number) {
    return this.carModelRepository.find({
      where: { brand_id: brandId },
      order: { name: 'ASC' },
    });
  }

  /**
   * Motor markalarını getir (public)
   */
  async getMotorBrands() {
    return this.motorBrandRepository.find({
      order: { name: 'ASC' },
    });
  }

  /**
   * Motor modellerini getir (public)
   */
  async getMotorModels(brandId: number) {
    return this.motorModelRepository.find({
      where: { brand_id: brandId },
      order: { name: 'ASC' },
    });
  }

  /**
   * Kullanıcı satın alma işlemi
   * Müşteri bilgileri + araç bilgileri + paket + iyzico ödeme
   */
  async processPurchase(input: {
    // Müşteri bilgileri
    customer: {
      name: string;
      surname: string;
      tc_vkn: string;
      phone: string;
      email?: string;
      city?: string;
      district?: string;
      address?: string;
    };
    // Araç bilgileri
    vehicle: {
      plate: string;
      brand_id?: number;
      model_id?: number;
      motor_brand_id?: number;
      motor_model_id?: number;
      model_year: number;
      usage_type: string;
      vehicle_type: string;
      is_foreign_plate?: boolean;
    };
    // Paket
    package_id: string;
    // İyzico ödeme bilgileri
    card: {
      cardHolderName: string;
      cardNumber: string;
      expireMonth: string;
      expireYear: string;
      cvc: string;
    };
    // Sözleşme onayı
    terms_accepted: boolean;
  }) {
    // Sözleşme onayı kontrolü
    if (!input.terms_accepted) {
      throw new AppError(400, 'Mesafeli satış sözleşmesini onaylamanız gerekmektedir');
    }

    // Paketi al
    const pkg = await this.packageRepository.findOne({
      where: { id: input.package_id, status: EntityStatus.ACTIVE },
    });

    if (!pkg) {
      throw new AppError(404, 'Paket bulunamadı veya aktif değil');
    }

    // Araç yaşı kontrolü
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - input.vehicle.model_year;
    if (vehicleAge > pkg.max_vehicle_age) {
      throw new AppError(400, `Bu paket için araç yaşı maksimum ${pkg.max_vehicle_age} olmalıdır`);
    }

    // Araç türü kontrolü
    if (input.vehicle.vehicle_type !== pkg.vehicle_type) {
      throw new AppError(400, 'Seçilen paket bu araç türü için uygun değil');
    }

    // Transaction başlat
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Müşteri oluştur (bireysel müşteri olarak - acente/şube olmadan)
      const customer = queryRunner.manager.create(Customer, {
        is_corporate: false,
        tc_vkn: input.customer.tc_vkn,
        name: input.customer.name,
        surname: input.customer.surname,
        phone: input.customer.phone,
        email: input.customer.email,
        city: input.customer.city,
        district: input.customer.district,
        address: input.customer.address,
        // agency_id ve branch_id null - direkt satış
      });
      await queryRunner.manager.save(customer);

      // 2. Araç oluştur
      const isMotorcycle = input.vehicle.vehicle_type === 'Motosiklet';
      
      // usage_type string'i enum'a dönüştür
      const usageTypeMap: Record<string, UsageType> = {
        'PRIVATE': UsageType.PRIVATE,
        'COMMERCIAL': UsageType.COMMERCIAL,
        'TAXI': UsageType.TAXI,
      };
      const usageType = usageTypeMap[input.vehicle.usage_type] || UsageType.PRIVATE;
      
      const vehicle = queryRunner.manager.create(Vehicle, {
        customer_id: customer.id,
        is_foreign_plate: input.vehicle.is_foreign_plate || false,
        plate: input.vehicle.plate.toUpperCase().replace(/\s/g, ''),
        vehicle_type: input.vehicle.vehicle_type,
        brand_id: isMotorcycle ? null : input.vehicle.brand_id,
        model_id: isMotorcycle ? null : input.vehicle.model_id,
        motor_brand_id: isMotorcycle ? input.vehicle.motor_brand_id : null,
        motor_model_id: isMotorcycle ? input.vehicle.motor_model_id : null,
        model_year: input.vehicle.model_year,
        usage_type: usageType,
        // agency_id ve branch_id null
      });
      await queryRunner.manager.save(vehicle);

      // 3. Satış oluştur
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // 1 yıllık poliçe

      // Poliçe numarası oluştur
      const policyNumber = `PUB-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const sale = queryRunner.manager.create(Sale, {
        customer_id: customer.id,
        vehicle_id: vehicle.id,
        package_id: pkg.id,
        price: pkg.price,
        commission: 0, // Direkt satışta komisyon yok
        branch_commission: 0,
        agency_commission: 0,
        start_date: startDate,
        end_date: endDate,
        policy_number: policyNumber,
        // agency_id, branch_id, user_id null - public satış
      });
      await queryRunner.manager.save(sale);

      // 4. İyzico ile ödeme işlemi
      const paymentResult = await this.iyzicoService.processPayment({
        price: parseFloat(pkg.price.toString()),
        currency: 'TRY',
        conversationId: sale.id,
        paymentCard: {
          cardHolderName: input.card.cardHolderName,
          cardNumber: input.card.cardNumber,
          expireMonth: input.card.expireMonth,
          expireYear: input.card.expireYear,
          cvc: input.card.cvc,
        },
        buyer: {
          id: customer.id,
          name: customer.name,
          surname: customer.surname || '',
          email: customer.email || 'no-email@example.com',
          phone: customer.phone,
        },
        shippingAddress: {
          contactName: `${customer.name} ${customer.surname || ''}`,
          city: customer.city || 'İstanbul',
          country: 'Turkey',
          address: customer.address || customer.city || 'Türkiye',
        },
        billingAddress: {
          contactName: `${customer.name} ${customer.surname || ''}`,
          city: customer.city || 'İstanbul',
          country: 'Turkey',
          address: customer.address || customer.city || 'Türkiye',
        },
        basketItems: [
          {
            id: pkg.id,
            name: pkg.name,
            category1: 'Yol Yardım Paketi',
            itemType: 'VIRTUAL',
            price: parseFloat(pkg.price.toString()),
          },
        ],
      });

      if (paymentResult.status !== 'success') {
        throw new AppError(400, paymentResult.errorMessage || 'Ödeme işlemi başarısız oldu');
      }

      // 5. Payment kaydı oluştur
      const payment = queryRunner.manager.create(Payment, {
        sale_id: sale.id,
        amount: pkg.price,
        type: PaymentType.IYZICO,
        status: PaymentStatus.COMPLETED,
        transaction_id: paymentResult.paymentId,
        payment_details: {
          card_holder: input.card.cardHolderName,
          card_last_four: input.card.cardNumber.slice(-4),
          payment_date: new Date().toISOString(),
          iyzico_response: {
            paymentId: paymentResult.paymentId,
            conversationId: paymentResult.conversationId,
          },
        },
      });
      await queryRunner.manager.save(payment);

      // Transaction'ı commit et
      await queryRunner.commitTransaction();

      return {
        success: true,
        sale_id: sale.id,
        policy_number: policyNumber,
        customer_name: `${customer.name} ${customer.surname || ''}`,
        vehicle_plate: vehicle.plate,
        package_name: pkg.name,
        price: pkg.price,
        start_date: startDate,
        end_date: endDate,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}


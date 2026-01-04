import { AppDataSource } from '../config/database';
import { Payment } from '../entities/Payment';
import { Agency } from '../entities/Agency';
import { Branch } from '../entities/Branch';
import { Sale } from '../entities/Sale';
import { Customer } from '../entities/Customer';
import { Vehicle } from '../entities/Vehicle';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { PaymentType, PaymentStatus } from '../types/enums';
import { PayTRService } from './PayTRService';

export class PaymentService {
  private paymentRepository = AppDataSource.getRepository(Payment);
  private agencyRepository = AppDataSource.getRepository(Agency);
  private saleRepository = AppDataSource.getRepository(Sale);
  private customerRepository = AppDataSource.getRepository(Customer);
  private vehicleRepository = AppDataSource.getRepository(Vehicle);
  private paytrService = new PayTRService();

  async getAll(filter?: any) {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.sale', 'sale')
      .leftJoinAndSelect('payment.agency', 'agency')
      .orderBy('payment.created_at', 'DESC');

    // Payment entity'sinde sadece agency_id var, branch_id ve created_by yok
    // Bu yüzden özel filtreleme yapıyoruz
    if (filter) {
      if (filter.agency_id) {
        queryBuilder.andWhere('payment.agency_id = :agency_id', { agency_id: filter.agency_id });
      }
      // branch_id ve created_by için sale üzerinden filtreleme yapılabilir
      if (filter.branch_id) {
        queryBuilder.andWhere('sale.branch_id = :branch_id', { branch_id: filter.branch_id });
      }
      if (filter.created_by) {
        queryBuilder.andWhere('sale.user_id = :user_id', { user_id: filter.created_by });
      }
    }

    const payments = await queryBuilder.getMany();
    return payments;
  }

  async getById(id: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['sale', 'agency'],
    });

    if (!payment) {
      throw new AppError(404, 'Payment not found');
    }

    return payment;
  }

  async create(data: Partial<Payment>) {
    const payment = this.paymentRepository.create(data);
    await this.paymentRepository.save(payment);
    return payment;
  }

  /**
   * PayTR token alma (iFrame için)
   * PayTR asenkron çalışır, bu metod sadece token döndürür
   * Ödeme işlemi callback'te yapılacak
   */
  async getPaytrToken(saleIdOrTempOid: string, req: any, options?: {
    merchantOkUrl?: string;
    merchantFailUrl?: string;
    noInstallment?: number;
    maxInstallment?: number;
  }) {
    // Önce payment'ı bul (temp_merchant_oid veya transaction_id ile)
    // PayTR'den gelen merchant_oid sanitize edilmiş olabilir
    // Payment_details'te hem temp_merchant_oid (orijinal) hem de sanitized_merchant_oid (sanitize edilmiş) var
    // transaction_id artık sanitize edilmiş merchant_oid ile oluşturuluyor
    console.log('🔍 Searching for payment with saleIdOrTempOid:', saleIdOrTempOid);
    
    let payment = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('JSON_EXTRACT(payment.payment_details, "$.sanitized_merchant_oid") = :oid', { 
        oid: saleIdOrTempOid 
      })
      .orWhere('JSON_EXTRACT(payment.payment_details, "$.temp_merchant_oid") = :oid', { 
        oid: saleIdOrTempOid 
      })
      .orWhere('payment.transaction_id LIKE :transactionId', { 
        transactionId: `PAYTR_PENDING_${saleIdOrTempOid}_%` 
      })
      .orWhere('payment.sale_id = :saleId', { 
        saleId: saleIdOrTempOid 
      })
      .orderBy('payment.created_at', 'DESC')
      .getOne();
    
    // Eğer bulunamazsa, saleIdOrTempOid'yi sanitize et ve tekrar dene
    if (!payment) {
      console.log('⚠️ Payment not found with original ID, trying sanitized version...');
      const sanitizedOid = saleIdOrTempOid.replace(/[^a-zA-Z0-9]/g, '');
      if (sanitizedOid !== saleIdOrTempOid) {
        console.log('🔍 Searching with sanitized ID:', sanitizedOid);
        payment = await this.paymentRepository
          .createQueryBuilder('payment')
          .where('JSON_EXTRACT(payment.payment_details, "$.sanitized_merchant_oid") = :oid', { 
            oid: sanitizedOid 
          })
          .orWhere('JSON_EXTRACT(payment.payment_details, "$.temp_merchant_oid") = :oid', { 
            oid: sanitizedOid 
          })
          .orWhere('payment.transaction_id LIKE :transactionId', { 
            transactionId: `PAYTR_PENDING_${sanitizedOid}_%` 
          })
          .orderBy('payment.created_at', 'DESC')
          .getOne();
      }
    }
    
    if (payment) {
      console.log('✅ Payment found:', payment.id);
      console.log('Payment temp_merchant_oid:', payment.payment_details?.temp_merchant_oid);
      console.log('Payment sanitized_merchant_oid:', payment.payment_details?.sanitized_merchant_oid);
      console.log('Payment transaction_id:', payment.transaction_id);
    } else {
      console.error('❌ Payment not found for saleIdOrTempOid:', saleIdOrTempOid);
    }

    let customer: Customer | null = null;
    let packageName = 'Paket';
    let salePrice = 0;
    let agencyId: string | null = null;

    if (payment && payment.payment_details?.sale_data) {
      // Payment'dan satış bilgilerini al
      const saleData = payment.payment_details.sale_data;
      
      // Yeni format: customer bilgileri sale_data.customer içinde
      if (saleData.customer) {
        // Customer bilgilerini sale_data'dan al
        const customerData = saleData.customer;
        // Mevcut müşteriyi kontrol et veya yeni oluştur (sadece bilgileri almak için)
        const existingCustomer = await this.customerRepository.findOne({
          where: { tc_vkn: customerData.tc_vkn }
        });
        customer = existingCustomer || {
          name: customerData.name,
          surname: customerData.surname || '',
          email: customerData.email || '',
          phone: customerData.phone || '',
        } as any;
      } else if (saleData.customer_id) {
        // Eski format: customer_id var
        customer = await this.customerRepository.findOne({
          where: { id: saleData.customer_id }
        });
      }
      
      const { Package } = await import('../entities/Package');
      const packageRepository = AppDataSource.getRepository(Package);
      const pkg = await packageRepository.findOne({
        where: { id: saleData.sale?.package_id || saleData.package_id }
      });
      
      packageName = pkg?.name || 'Paket';
      salePrice = saleData.sale?.price || saleData.price;
      agencyId = saleData.agency_id;
    } else if (!payment) {
      // Eski yöntem: Sale'dan bilgileri al (geriye dönük uyumluluk için)
      const sale = await this.saleRepository.findOne({
        where: { id: saleIdOrTempOid },
        relations: ['customer', 'vehicle', 'agency', 'package'],
      });

      if (!sale) {
        throw new AppError(404, 'Sale or payment not found');
      }

      // Customer veya UserCustomer kontrolü
      if (!sale.customer_id && !sale.user_customer_id) {
        throw new AppError(404, 'Customer not found');
      }

      customer = sale.customer_id
        ? await this.customerRepository.findOne({
            where: { id: sale.customer_id },
          })
        : null;

      if (!customer) {
        throw new AppError(404, 'Customer not found');
      }

      packageName = sale.package?.name || 'Paket';
      salePrice = typeof sale.price === 'string' ? parseFloat(sale.price) : (sale.price || 0);
      agencyId = sale.agency_id;
    } else {
      // Payment bulundu ama sale_data yok - bu durumda sale'ı bul
      if (payment.sale_id) {
        const sale = await this.saleRepository.findOne({
          where: { id: payment.sale_id },
          relations: ['customer', 'vehicle', 'agency', 'package'],
        });

        if (sale) {
          customer = sale.customer_id
            ? await this.customerRepository.findOne({
                where: { id: sale.customer_id },
              })
            : null;

          packageName = sale.package?.name || 'Paket';
          salePrice = typeof sale.price === 'string' ? parseFloat(sale.price) : (sale.price || 0);
          agencyId = sale.agency_id;
        }
      }
    }

    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }
    
    if (!payment) {
      throw new AppError(404, 'Payment not found');
    }

    // Sistem kaydı kontrolü - agency_id yoksa ödeme alınamaz
    if (!agencyId) {
      throw new AppError(400, 'Sistem kaydı için ödeme işlemi yapılamaz. Lütfen bir acenteye atayın.');
    }

    // Kullanıcı IP adresini al
    const userIp = this.paytrService.getUserIp(req);

    // Ödeme tutarını kuruş cinsine çevir (100 ile çarp)
    const paymentAmount = Math.round(salePrice * 100);

    // Sepet içeriği oluştur
    const basketItems = [
      {
        name: packageName,
        price: salePrice,
        quantity: 1,
      },
    ];
    const userBasket = this.paytrService.createBasket(basketItems);

    // merchant_ok_url ve merchant_fail_url'e merchant_oid'yi query parameter olarak ekle
    const baseOkUrl = options?.merchantOkUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success`;
    const baseFailUrl = options?.merchantFailUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/fail`;
    const merchantOkUrl = `${baseOkUrl}${baseOkUrl.includes('?') ? '&' : '?'}merchant_oid=${saleIdOrTempOid}`;
    const merchantFailUrl = `${baseFailUrl}${baseFailUrl.includes('?') ? '&' : '?'}merchant_oid=${saleIdOrTempOid}`;

    // PayTR token al
    const tokenResult = await this.paytrService.getToken({
      merchantOid: saleIdOrTempOid,
      email: customer.email || 'customer@example.com',
      paymentAmount: paymentAmount,
      currency: 'TL',
      userBasket: userBasket,
      userIp: userIp,
      userName: `${customer.name} ${customer.surname || ''}`,
      // PayTR user_address zorunlu, boşsa varsayılan değer gönder
      userAddress: customer.address || customer.city || 'Belirtilmemiş',
      userPhone: customer.phone || '',
      merchantOkUrl: merchantOkUrl,
      merchantFailUrl: merchantFailUrl,
      noInstallment: options?.noInstallment ?? 0,
      maxInstallment: options?.maxInstallment ?? 0,
      timeoutLimit: 30,
      lang: 'tr',
      testMode: process.env.NODE_ENV === 'development' ? 1 : 0,
      debugOn: process.env.NODE_ENV === 'development' ? 1 : 0,
    });

    if (tokenResult.status !== 'success' || !tokenResult.token) {
      console.error('PayTR token alma hatası:', {
        status: tokenResult.status,
        reason: tokenResult.reason,
        merchantOid: saleIdOrTempOid,
        paymentAmount,
        email: customer.email,
      });
      throw new AppError(400, tokenResult.reason || 'PayTR token alınamadı');
    }

    return {
      token: tokenResult.token,
      iframeUrl: `https://www.paytr.com/odeme/guvenli/${tokenResult.token}`,
    };
  }

  async processBalance(saleId: string, paymentData: any) {
    // Önce satışı bul ve agency_id'yi al
    const sale = await this.saleRepository.findOne({
      where: { id: saleId },
      relations: ['agency'],
    });

    if (!sale) {
      throw new AppError(404, 'Sale not found');
    }

    // Sistem kaydı kontrolü - agency_id yoksa bakiye ödemesi alınamaz
    if (!sale.agency_id) {
      throw new AppError(400, 'Sistem kayıtları için bakiye ödemesi yapılamaz. Lütfen satışı bir acenteye atayın.');
    }

    // Agency_id'yi sale'den al (artık kesinlikle string)
    const agencyId = sale.agency_id;
    
    const agency = await this.agencyRepository.findOne({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new AppError(404, 'Agency not found');
    }

    // Amount'u sale'den al (paymentData.amount yoksa)
    const amount = paymentData.amount || sale.price || 0;
    
    // Sayısal değerlere çevir ve NaN kontrolü yap
    const currentBalance = parseFloat(agency.balance?.toString() || '0') || 0;
    const paymentAmount = parseFloat(amount?.toString() || '0') || 0;

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new AppError(400, 'Invalid payment amount');
    }

    if (currentBalance < paymentAmount) {
      throw new AppError(400, `Yetersiz bakiye. Mevcut: ${currentBalance.toFixed(2)} TL, Gerekli: ${paymentAmount.toFixed(2)} TL`);
    }

    // Bakiyeden düş
    agency.balance = currentBalance - paymentAmount;
    await this.agencyRepository.save(agency);

    const payment = this.paymentRepository.create({
      sale_id: saleId,
      agency_id: agencyId,
      amount: paymentAmount,
      type: PaymentType.BALANCE,
      status: PaymentStatus.COMPLETED,
      transaction_id: 'BALANCE_' + Date.now(),
      payment_details: { ...paymentData, deducted_from_balance: paymentAmount },
    });

    await this.paymentRepository.save(payment);
    return payment;
  }

  /**
   * PayTR bildirim callback işleme
   * PayTR ödeme sonucunu bildirir, bu metod hash doğrulayıp ödeme kaydını günceller
   */
  async handlePaytrCallback(callbackData: {
    merchant_oid: string;
    status: string;
    total_amount: string;
    hash: string;
    failed_reason_code?: string;
    failed_reason_msg?: string;
    test_mode?: string;
    payment_type?: string;
    currency?: string;
    payment_amount?: string;
  }): Promise<{ success: boolean; message: string }> {
    console.log('=== PayTR Callback Received ===');
    console.log('Merchant OID:', callbackData.merchant_oid);
    console.log('Status:', callbackData.status);
    console.log('Total Amount:', callbackData.total_amount);
    
    // Hash doğrulama (güvenlik için kritik)
    // PayTR bildirim hash formülü: merchant_oid + merchant_salt + status + total_amount
    const isValidHash = this.paytrService.verifyCallbackHash(
      callbackData.merchant_oid,
      callbackData.status,
      callbackData.total_amount,
      callbackData.hash
    );

    if (!isValidHash) {
      // Test modunda hash kontrolünü atla (sadece development için)
      if (process.env.NODE_ENV === 'development' || callbackData.test_mode === '1') {
        console.warn('⚠️ Hash validation skipped in development/test mode');
      } else {
        console.error('Invalid hash - notification rejected');
        throw new AppError(400, 'Invalid hash - notification rejected');
      }
    }

    // Payment'ı bul (merchant_oid ile)
    // PayTR'den gelen merchant_oid sanitize edilmiş (özel karakterler kaldırılmış) olabilir
    // Ama payment_details'teki temp_merchant_oid sanitize edilmemiş olarak saklanıyor
    const merchantOid = callbackData.merchant_oid;
    
    // PayTR'den gelen merchant_oid sanitize edilmiş (özel karakterler kaldırılmış)
    // Payment_details'te hem temp_merchant_oid (orijinal) hem de sanitized_merchant_oid (sanitize edilmiş) var
    // Önce sanitized_merchant_oid ile dene
    let payment = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('JSON_EXTRACT(payment.payment_details, "$.sanitized_merchant_oid") = :oid', { oid: merchantOid })
      .orWhere('JSON_EXTRACT(payment.payment_details, "$.temp_merchant_oid") = :oid', { oid: merchantOid })
      .orWhere('payment.transaction_id LIKE :transactionId', { transactionId: `PAYTR_PENDING_${merchantOid}_%` })
      .orderBy('payment.created_at', 'DESC')
      .getOne();
    
    // Eğer bulunamazsa, merchant_oid'yi sanitize et ve tekrar dene
    if (!payment) {
      const sanitizedOid = merchantOid.replace(/[^a-zA-Z0-9]/g, '');
      if (sanitizedOid !== merchantOid) {
        payment = await this.paymentRepository
          .createQueryBuilder('payment')
          .where('JSON_EXTRACT(payment.payment_details, "$.sanitized_merchant_oid") = :oid', { oid: sanitizedOid })
          .orWhere('JSON_EXTRACT(payment.payment_details, "$.temp_merchant_oid") = :oid', { oid: sanitizedOid })
          .orWhere('payment.transaction_id LIKE :transactionId', { transactionId: `PAYTR_PENDING_${sanitizedOid}_%` })
          .orderBy('payment.created_at', 'DESC')
          .getOne();
      }
    }
    
    // Eğer hala bulunamazsa, UUID formatına çevirip sale_id ile dene (eski yöntem için)
    if (!payment && merchantOid.length === 32) {
      const uuidFormat = `${merchantOid.substring(0, 8)}-${merchantOid.substring(8, 12)}-${merchantOid.substring(12, 16)}-${merchantOid.substring(16, 20)}-${merchantOid.substring(20)}`;
      payment = await this.paymentRepository.findOne({
        where: { sale_id: uuidFormat },
        order: { created_at: 'DESC' },
      });
    }
    
    if (!payment) {
      console.error('Payment not found for merchant_oid:', merchantOid);
      throw new AppError(404, 'Payment not found');
    }
    
    console.log('Payment found:', payment.id);
    console.log('Payment sale_id:', payment.sale_id);
    console.log('Payment temp_merchant_oid:', payment.payment_details?.temp_merchant_oid);
    
    // Sale'ı kontrol et (varsa)
    let sale = payment.sale_id ? await this.saleRepository.findOne({
      where: { id: payment.sale_id },
      relations: ['agency', 'package', 'customer'],
    }) : null;
    
    // Eğer sale yoksa ve payment_details'te sale_data varsa, tüm kayıtları oluştur
    const saleData = payment.payment_details?.sale_data;
    console.log('=== Sale Creation Check ===');
    console.log('Sale exists:', !!sale);
    console.log('Sale data exists:', !!saleData);
    console.log('Callback status:', callbackData.status);
    console.log('Payment ID:', payment.id);
    console.log('Payment sale_id:', payment.sale_id);
    
    if (!sale && saleData && callbackData.status === 'success') {
      console.log('✅ Creating sale from payment_details...');
      console.log('Customer data:', saleData.customer ? 'exists' : 'missing');
      console.log('Vehicle data:', saleData.vehicle ? 'exists' : 'missing');
      console.log('Sale data:', saleData.sale ? 'exists' : 'missing');
      // Transaction başlat - tüm kayıtlar birlikte oluşturulacak
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 1. Müşteri oluştur veya bul
        let customer: Customer;
        if (saleData.customer?.tc_vkn) {
          // Mevcut müşteriyi kontrol et
          const existingCustomer = await this.customerRepository.findOne({
            where: { tc_vkn: saleData.customer.tc_vkn }
          });

          if (existingCustomer) {
            customer = existingCustomer;
          } else {
            // Yeni müşteri oluştur
            customer = queryRunner.manager.create(Customer, {
              is_corporate: saleData.customer.is_corporate,
              tc_vkn: saleData.customer.tc_vkn,
              name: saleData.customer.name,
              surname: saleData.customer.surname,
              tax_office: saleData.customer.tax_office,
              birth_date: saleData.customer.birth_date,
              phone: saleData.customer.phone,
              email: saleData.customer.email,
              city: saleData.customer.city,
              district: saleData.customer.district,
              address: saleData.customer.address,
            });
            customer = await queryRunner.manager.save(customer);
          }
        } else {
          throw new AppError(400, 'Customer data not found in payment details');
        }

        // 2. Araç oluştur veya bul
        let vehicle: Vehicle;
        if (saleData.vehicle?.plate) {
          // Mevcut aracı kontrol et
          const existingVehicle = await this.vehicleRepository.findOne({
            where: { plate: saleData.vehicle.plate.toUpperCase() }
          });

          if (existingVehicle) {
            vehicle = existingVehicle;
          } else {
            // Yeni araç oluştur
            const isMotorcycle = saleData.vehicle.vehicle_type === 'Motosiklet';
            const vehicleData: any = {
              customer_id: customer.id,
              agency_id: saleData.agency_id || undefined,
              branch_id: saleData.branch_id || undefined,
              vehicle_type: saleData.vehicle.vehicle_type,
              is_foreign_plate: saleData.vehicle.is_foreign_plate,
              plate: saleData.vehicle.plate.toUpperCase(),
              registration_serial: saleData.vehicle.registration_serial?.toUpperCase() || undefined,
              registration_number: saleData.vehicle.registration_number || undefined,
              model_year: saleData.vehicle.model_year,
              usage_type: saleData.vehicle.usage_type as any,
            };

            if (isMotorcycle) {
              vehicleData.motor_brand_id = saleData.vehicle.motor_brand_id || undefined;
              vehicleData.motor_model_id = saleData.vehicle.motor_model_id || undefined;
            } else {
              vehicleData.brand_id = saleData.vehicle.brand_id || undefined;
              vehicleData.model_id = saleData.vehicle.model_id || undefined;
            }

            vehicle = queryRunner.manager.create(Vehicle, vehicleData);
            vehicle = await queryRunner.manager.save(vehicle);
          }
        } else {
          throw new AppError(400, 'Vehicle data not found in payment details');
        }

        // 3. Satış oluştur
        const policyNumber = `POL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        sale = queryRunner.manager.create(Sale, {
          customer_id: customer.id,
          vehicle_id: vehicle.id,
          package_id: saleData.sale.package_id,
          price: saleData.sale.price,
          commission: saleData.sale.commission || 0,
          branch_commission: saleData.sale.branch_commission || null,
          agency_commission: saleData.sale.agency_commission || null,
          start_date: saleData.sale.start_date,
          end_date: saleData.sale.end_date,
          policy_number: policyNumber,
          agency_id: saleData.agency_id || null,
          branch_id: saleData.branch_id || null,
          user_id: saleData.user_id || null,
        });
        sale = await queryRunner.manager.save(sale);

        // 4. Bakiye güncellemeleri (komisyonlar)
        if (saleData.branch_id && saleData.sale.branch_commission && saleData.sale.branch_commission > 0) {
          const { Branch } = await import('../entities/Branch');
          const branch = await queryRunner.manager.findOne(Branch, {
            where: { id: saleData.branch_id }
          });
          if (branch) {
            const currentBalance = parseFloat(branch.balance?.toString() || '0') || 0;
            branch.balance = currentBalance + saleData.sale.branch_commission;
            await queryRunner.manager.save(branch);
          }
        }

        if (saleData.agency_id && saleData.sale.agency_commission && saleData.sale.agency_commission > 0) {
          const agency = await queryRunner.manager.findOne(Agency, {
            where: { id: saleData.agency_id }
          });
          if (agency) {
            const currentBalance = parseFloat(agency.balance?.toString() || '0') || 0;
            agency.balance = currentBalance + saleData.sale.agency_commission;
            await queryRunner.manager.save(agency);
          }
        }

        // Transaction'ı commit et
        await queryRunner.commitTransaction();
        await queryRunner.release();

        // Payment'ın sale_id'sini güncelle
        payment.sale_id = sale.id;
      } catch (error) {
        console.error('❌ Error creating sale from payment_details:', error);
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        if (queryRunner.isReleased === false) {
          await queryRunner.release();
        }
        throw error;
      }
    }

    // Eğer ödeme zaten onaylandıysa veya iptal edildiyse, sadece OK döndür
    if (payment && (payment.status === PaymentStatus.COMPLETED || payment.status === PaymentStatus.FAILED)) {
      return { success: true, message: 'Payment already processed' };
    }

    // Ödeme tutarını parse et (kuruş cinsinden gelir, TL'ye çevir)
    // Eğer callback'te total_amount yoksa veya 0 ise, payment_details'ten al
    let totalAmount = callbackData.total_amount && parseFloat(callbackData.total_amount) > 0
      ? parseFloat(callbackData.total_amount) / 100
      : (payment.payment_details?.sale_data?.sale?.price || payment.amount || 0);
    
    const paymentAmount = callbackData.payment_amount 
      ? parseFloat(callbackData.payment_amount) / 100 
      : totalAmount;

    if (callbackData.status === 'success') {
      // Ödeme başarılı
      // Mevcut ödeme kaydını güncelle
      payment.status = PaymentStatus.COMPLETED;
      payment.amount = totalAmount;
      payment.transaction_id = payment.transaction_id || `PAYTR_${callbackData.merchant_oid}_${Date.now()}`;
      payment.payment_details = {
        ...payment.payment_details,
        paytr_response: callbackData,
        total_amount: totalAmount,
        payment_amount: paymentAmount,
        payment_type: callbackData.payment_type,
        currency: callbackData.currency || 'TL',
        test_mode: callbackData.test_mode === '1',
      };

      await this.paymentRepository.save(payment);
      
      // Eğer sale oluşturulduysa, SMS gönder
      if (sale) {
        try {
          const { SmsService } = await import('./SmsService');
          const smsService = new SmsService();
          
          // Customer bilgisini al (sale.customer relation'ından veya customer_id'den)
          let customer = sale.customer;
          if (!customer && sale.customer_id) {
            customer = await this.customerRepository.findOne({
              where: { id: sale.customer_id }
            });
          }
          
          if (customer && customer.phone) {
            const formatDate = (date: string | Date) => {
              const dateObj = typeof date === 'string' ? new Date(date) : date;
              const day = String(dateObj.getDate()).padStart(2, '0');
              const month = String(dateObj.getMonth() + 1).padStart(2, '0');
              const year = dateObj.getFullYear();
              return `${day}.${month}.${year}`;
            };
            
            const customerName = `${customer.name}${customer.surname ? ' ' + customer.surname : ''}`;
            // Package bilgisini al (sale.package relation'ından veya package_id'den)
            let packageName = sale.package?.name || 'Paket';
            if (!sale.package && sale.package_id) {
              const { Package } = await import('../entities/Package');
              const packageRepository = AppDataSource.getRepository(Package);
              const pkg = await packageRepository.findOne({
                where: { id: sale.package_id }
              });
              if (pkg) {
                packageName = pkg.name;
              }
            }
            
            const startDate = formatDate(sale.start_date);
            const endDate = formatDate(sale.end_date);
            
            // PDF linkini oluştur (temiz URL - frontend route)
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const pdfUrl = `${frontendUrl}/pdf/sale/${sale.id}`;
            
            const smsMessage = `Sayın ${customerName}, ${packageName} paketiniz başarıyla oluşturuldu. Satış No: ${sale.policy_number}, Başlangıç: ${startDate}, Bitiş: ${endDate}. Sözleşme: ${pdfUrl} 7/24 Destek: 0850 304 54 40`;
            console.log('📱 SMS gönderiliyor (PayTR callback):', customer.phone);
            await smsService.sendSingleSms(customer.phone, smsMessage);
            console.log('✅ SMS başarıyla gönderildi (PayTR callback)');
          } else {
            console.log('⚠️ SMS gönderilemedi (PayTR callback): Customer veya phone bulunamadı');
          }
        } catch (error: any) {
          console.error('❌ SMS gönderme hatası (PayTR callback):', error.message);
        }
      } else {
        console.log('⚠️ SMS gönderilemedi (PayTR callback): Sale bulunamadı');
      }
      
      return { success: true, message: 'Payment completed successfully' };
    } else {
      // Ödeme başarısız - payment kaydını sil (hiçbir kayıt oluşturulmadı)
      await this.paymentRepository.remove(payment);
      
      return { success: true, message: 'Payment failed - no records created' };
    }
  }

  async refund(paymentId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['agency'],
    });

    if (!payment) {
      throw new AppError(404, 'Payment not found');
    }

    if (payment.status === PaymentStatus.REFUNDED) {
      throw new AppError(400, 'Payment already refunded');
    }

    // If balance payment, return to agency balance
    // agency_id nullable olduğu için kontrol et
    if (payment.type === PaymentType.BALANCE && payment.agency_id) {
      const agency = await this.agencyRepository.findOne({
        where: { id: payment.agency_id },
      });

      if (agency) {
        agency.balance = parseFloat(agency.balance.toString()) + parseFloat(payment.amount.toString());
        await this.agencyRepository.save(agency);
      }
    }

    payment.status = PaymentStatus.REFUNDED;
    await this.paymentRepository.save(payment);

    return { message: 'Payment refunded successfully', payment };
  }
}

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
import { resolvePolicyDates } from '../utils/policyDates';
import { PayTRService } from './PayTRService';

export class PaymentService {
  private paymentRepository = AppDataSource.getRepository(Payment);
  private agencyRepository = AppDataSource.getRepository(Agency);
  private branchRepository = AppDataSource.getRepository(Branch);
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
    // MySQL'de JSON_EXTRACT tırnaklı döndürür, bu yüzden ->> operatörü kullanmalıyız
    console.log('🔍 Searching for payment with saleIdOrTempOid:', saleIdOrTempOid);
    
    let payment = await this.paymentRepository
      .createQueryBuilder('payment')
      .where(`(
        payment.payment_details IS NOT NULL AND (
          JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.sanitized_merchant_oid')) = :oid OR
          JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.temp_merchant_oid')) = :oid OR
          JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.paytr_sent_merchant_oid')) = :oid
        )
      ) OR payment.transaction_id LIKE :transactionId OR payment.sale_id = :saleId`, { 
        oid: saleIdOrTempOid,
        transactionId: `PAYTR_PENDING_${saleIdOrTempOid}_%`,
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
          .where(`(
            payment.payment_details IS NOT NULL AND (
              JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.sanitized_merchant_oid')) = :oid OR
              JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.temp_merchant_oid')) = :oid OR
              JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.paytr_sent_merchant_oid')) = :oid
            )
          ) OR payment.transaction_id LIKE :transactionId`, { 
            oid: sanitizedOid,
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
    // ÖNEMLİ: PayTRService.getToken içinde merchant_oid tekrar sanitize ediliyor
    // Bu yüzden PayTR'ye gönderilen gerçek merchant_oid'yi payment kaydına kaydetmemiz gerekiyor
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

    // PayTR'ye gönderilen merchant_oid'yi payment kaydına kaydet
    // PayTRService.getToken içinde merchant_oid sanitize ediliyor, bu yüzden sanitize edilmiş versiyonu kaydet
    if (payment) {
      const paytrSentMerchantOid = this.paytrService.sanitizeMerchantOid(saleIdOrTempOid);
      payment.payment_details = payment.payment_details || {};
      payment.payment_details.paytr_sent_merchant_oid = paytrSentMerchantOid; // PayTR'ye gönderilen gerçek merchant_oid
      payment.payment_details.paytr_token = tokenResult.token;
      payment.payment_details.token_requested_at = new Date().toISOString();
      await this.paymentRepository.save(payment);
      console.log('✅ Payment kaydı güncellendi - PayTR merchant_oid kaydedildi:', paytrSentMerchantOid);
    }

    return {
      token: tokenResult.token,
      iframeUrl: `https://www.paytr.com/odeme/guvenli/${tokenResult.token}`,
    };
  }

  /**
   * Bakiye ile ödeme: Satış daha önce oluşturulmuş ve komisyon bakiyeye eklenmiş olabilir.
   * Bakiye ile ödemede komisyon hesaplanmaz; bu satış için eklenen komisyonu geri alıp
   * sadece satış tutarını bakiyeden düşüyoruz. Sale commission alanlarını 0 yapıyoruz (raporlama tutarlılığı).
   */
  async processBalance(saleId: string, paymentData: any) {
    // Satışı branch/agency ilişkileriyle al; komisyon tutarlarını okuyacağız
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

    const agencyId = sale.agency_id;
    const agency = await this.agencyRepository.findOne({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new AppError(404, 'Agency not found');
    }

    // Bu satış için daha önce bakiyeye eklenmiş komisyonu geri al (bakiye ile ödemede komisyon yok)
    const branchCommission = parseFloat(sale.branch_commission?.toString() || '0') || 0;
    const agencyCommission = parseFloat(sale.agency_commission?.toString() || sale.commission?.toString() || '0') || 0;

    if (sale.branch_id && branchCommission > 0) {
      const branch = await this.branchRepository.findOne({
        where: { id: sale.branch_id },
      });
      if (branch) {
        const branchBalance = parseFloat(branch.balance?.toString() || '0') || 0;
        if (branchBalance >= branchCommission) {
          branch.balance = branchBalance - branchCommission;
          await this.branchRepository.save(branch);
        }
      }
    }

    let agencyBalance = parseFloat(agency.balance?.toString() || '0') || 0;
    // Komisyonu geri al (bakiye ile ödemede bu satışa komisyon yazılmamış kabul edilir)
    agencyBalance -= agencyCommission;

    // Amount'u sale'den al (paymentData.amount yoksa)
    const amount = paymentData.amount || sale.price || 0;
    const paymentAmount = parseFloat(amount?.toString() || '0') || 0;

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new AppError(400, 'Invalid payment amount');
    }

    if (agencyBalance < paymentAmount) {
      throw new AppError(400, `Yetersiz bakiye. Mevcut: ${agencyBalance.toFixed(2)} TL, Gerekli: ${paymentAmount.toFixed(2)} TL`);
    }

    // Komisyon geri alındı + satış tutarı düşülecek: tek seferde bakiyeyi güncelle
    agency.balance = agencyBalance - paymentAmount;
    await this.agencyRepository.save(agency);

    // Bakiye ile ödendiği için satışın komisyon alanlarını 0 yap (raporlama tutarlılığı)
    sale.commission = 0;
    sale.branch_commission = null;
    sale.agency_commission = null;
    await this.saleRepository.save(sale);

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
    // Frontend'den manuel tetiklenen callback'ler için hash kontrolünü atla
    const isManualTrigger = callbackData.hash === 'callback_triggered' || callbackData.hash === 'test_hash';
    
    let isValidHash = false;
    if (isManualTrigger) {
      console.warn('⚠️ Manual callback trigger detected - hash validation skipped');
      isValidHash = true; // Manuel tetikleme için hash kontrolünü atla
    } else {
      isValidHash = this.paytrService.verifyCallbackHash(
        callbackData.merchant_oid,
        callbackData.status,
        callbackData.total_amount,
        callbackData.hash
      );
    }

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
    
    console.log('🔍 Searching for payment with merchant_oid:', merchantOid);
    
    // MySQL'de JSON_EXTRACT tırnaklı döndürür, bu yüzden JSON_UNQUOTE veya ->> operatörü kullanmalıyız
    // ->> operatörü otomatik olarak unquote eder ve string döndürür
    // PayTR'den gelen merchant_oid sanitize edilmiş (özel karakterler kaldırılmış)
    // Payment_details'te hem temp_merchant_oid (orijinal) hem de sanitized_merchant_oid (sanitize edilmiş) var
    
    // Önce sanitized_merchant_oid ile dene (en yaygın durum)
    // payment_details NULL olabilir, bu yüzden NULL kontrolü ekliyoruz
    // MySQL'de JSON sorguları için JSON_UNQUOTE(JSON_EXTRACT(...)) kullanıyoruz
    // PayTR'ye gönderilen merchant_oid'yi de kontrol et (paytr_sent_merchant_oid)
    // Ayrıca transaction_id'de de arama yapıyoruz
    let payment = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.type = :type', { type: PaymentType.PAYTR })
      .andWhere(
        `(
          payment.payment_details IS NOT NULL AND (
            JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.sanitized_merchant_oid')) = :oid OR
            JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.temp_merchant_oid')) = :oid OR
            JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.paytr_sent_merchant_oid')) = :oid
          )
        ) OR payment.transaction_id LIKE :transactionId`,
        { 
          oid: merchantOid,
          transactionId: `PAYTR_PENDING_${merchantOid}_%`
        }
      )
      .orderBy('payment.created_at', 'DESC')
      .getOne();
    
    // Eğer bulunamazsa, merchant_oid'yi sanitize et ve tekrar dene
    if (!payment) {
      console.log('⚠️ Payment not found with original merchant_oid, trying sanitized version...');
      const sanitizedOid = merchantOid.replace(/[^a-zA-Z0-9]/g, '');
      if (sanitizedOid !== merchantOid) {
        console.log('🔍 Searching with sanitized merchant_oid:', sanitizedOid);
        payment = await this.paymentRepository
          .createQueryBuilder('payment')
          .where('payment.type = :type', { type: PaymentType.PAYTR })
          .andWhere(
            `(
              payment.payment_details IS NOT NULL AND (
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.sanitized_merchant_oid')) = :oid OR
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.temp_merchant_oid')) = :oid OR
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.paytr_sent_merchant_oid')) = :oid
              )
            ) OR payment.transaction_id LIKE :transactionId`,
            { 
              oid: sanitizedOid,
              transactionId: `PAYTR_PENDING_${sanitizedOid}_%`
            }
          )
          .orderBy('payment.created_at', 'DESC')
          .getOne();
      }
    }
    
    // Eğer hala bulunamazsa, timestamp'e göre de arama yap (temp1767605159617s5eblp formatı için)
    if (!payment && merchantOid.startsWith('temp')) {
      console.log('🔍 Trying timestamp-based search for:', merchantOid);
      // temp1767605159617s5eblp formatından timestamp'i çıkar (temp'den sonraki sayılar)
      const timestampMatch = merchantOid.match(/^temp(\d+)/);
      if (timestampMatch && timestampMatch[1]) {
        const timestamp = timestampMatch[1];
        console.log('🔍 Extracted timestamp:', timestamp);
        
        // Timestamp'e göre arama yap - transaction_id'de veya merchant_oid'lerde bu timestamp var mı?
        payment = await this.paymentRepository
          .createQueryBuilder('payment')
          .where('payment.type = :type', { type: PaymentType.PAYTR })
          .andWhere(
            `(
              payment.payment_details IS NOT NULL AND (
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.sanitized_merchant_oid')) LIKE :timestampPattern OR
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.temp_merchant_oid')) LIKE :timestampPattern OR
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.paytr_sent_merchant_oid')) LIKE :timestampPattern
              )
            ) OR payment.transaction_id LIKE :timestampPattern`,
            { 
              timestampPattern: `%${timestamp}%`
            }
          )
          .orderBy('payment.created_at', 'DESC')
          .getOne();
        
        if (payment) {
          console.log('✅ Payment found by timestamp:', payment.id);
          console.log('   Payment merchant_oid values:', {
            sanitized: payment.payment_details?.sanitized_merchant_oid,
            temp: payment.payment_details?.temp_merchant_oid,
            paytr_sent: payment.payment_details?.paytr_sent_merchant_oid,
            transaction_id: payment.transaction_id
          });
        } else {
          console.log('❌ No payment found by timestamp:', timestamp);
        }
      } else {
        console.log('⚠️ Could not extract timestamp from merchant_oid:', merchantOid);
      }
    }
    
    // Eğer hala bulunamazsa, tüm status'lerdeki payment'ları kontrol et (debug için)
    if (!payment) {
      console.log('⚠️ Payment still not found, checking all recent PayTR payments (all statuses)...');
      
      // Daha geniş bir zaman aralığında arama yap (son 100 payment)
      const allRecentPayments = await this.paymentRepository
        .createQueryBuilder('payment')
        .where('payment.type = :type', { type: PaymentType.PAYTR })
        .orderBy('payment.created_at', 'DESC')
        .limit(100)
        .getMany();
      
      console.log(`📊 Found ${allRecentPayments.length} recent PayTR payments (all statuses)`);
      
      // Callback'te gelen merchant_oid ile eşleşen payment'ı ara
      // Önce merchant_oid'yi normalize et (alt çizgileri kaldır)
      const normalizedMerchantOid = merchantOid.replace(/_/g, '');
      let foundMatch = false;
      for (const p of allRecentPayments) {
        const storedSanitized = p.payment_details?.sanitized_merchant_oid;
        const storedTemp = p.payment_details?.temp_merchant_oid;
        const storedPaytrSent = p.payment_details?.paytr_sent_merchant_oid;
        const transactionId = p.transaction_id;
        
        // Tüm değerleri normalize et (alt çizgileri kaldır)
        const normalizedSanitized = storedSanitized?.replace(/_/g, '') || '';
        const normalizedTemp = storedTemp?.replace(/_/g, '') || '';
        const normalizedPaytrSent = storedPaytrSent?.replace(/_/g, '') || '';
        const normalizedTransactionId = transactionId?.replace(/_/g, '') || '';
        
        // Eşleşme kontrolü - normalize edilmiş değerlerle karşılaştır
        const matchesSanitized = normalizedSanitized === normalizedMerchantOid || normalizedSanitized.includes(normalizedMerchantOid) || normalizedMerchantOid.includes(normalizedSanitized);
        const matchesTemp = normalizedTemp === normalizedMerchantOid || normalizedTemp.includes(normalizedMerchantOid) || normalizedMerchantOid.includes(normalizedTemp);
        const matchesPaytrSent = normalizedPaytrSent === normalizedMerchantOid || normalizedPaytrSent.includes(normalizedMerchantOid) || normalizedMerchantOid.includes(normalizedPaytrSent);
        const matchesTransaction = normalizedTransactionId.includes(normalizedMerchantOid) || normalizedMerchantOid.includes(normalizedTransactionId);
        
        if (matchesSanitized || matchesTemp || matchesPaytrSent || matchesTransaction) {
          console.log(`✅ MATCH FOUND! Payment ID: ${p.id}, Status: ${p.status}`);
          console.log(`   Original merchant_oid: ${merchantOid}`);
          console.log(`   Normalized merchant_oid: ${normalizedMerchantOid}`);
          console.log(`   sanitized_merchant_oid: ${storedSanitized} (normalized: ${normalizedSanitized})`);
          console.log(`   temp_merchant_oid: ${storedTemp} (normalized: ${normalizedTemp})`);
          console.log(`   paytr_sent_merchant_oid: ${storedPaytrSent} (normalized: ${normalizedPaytrSent})`);
          console.log(`   transaction_id: ${transactionId} (normalized: ${normalizedTransactionId})`);
          foundMatch = true;
          // Eşleşen payment'ı kullan
          if (!payment) {
            payment = p;
          }
          break; // İlk eşleşmeyi bulduğumuzda dur
        } else {
          // İlk 5 payment'ı göster (debug için)
          if (allRecentPayments.indexOf(p) < 5) {
            console.log(`  - Payment ID: ${p.id}, Status: ${p.status}, sanitized: ${storedSanitized}, temp: ${storedTemp}, paytr_sent: ${storedPaytrSent}, transaction_id: ${transactionId}`);
          }
        }
      }
      
      if (!foundMatch) {
        console.log(`❌ No matching payment found for merchant_oid: ${merchantOid}`);
        console.log(`   Searched in ${allRecentPayments.length} recent payments`);
      }
    }
    
    // Eğer hala bulunamazsa, UUID formatına çevirip sale_id ile dene (eski yöntem için)
    if (!payment && merchantOid.length === 32) {
      console.log('🔍 Trying UUID format conversion...');
      const uuidFormat = `${merchantOid.substring(0, 8)}-${merchantOid.substring(8, 12)}-${merchantOid.substring(12, 16)}-${merchantOid.substring(16, 20)}-${merchantOid.substring(20)}`;
      payment = await this.paymentRepository.findOne({
        where: { sale_id: uuidFormat },
        order: { created_at: 'DESC' },
      });
    }
    
    if (!payment) {
      console.error('❌ Payment not found for merchant_oid:', merchantOid);
      console.error('   This could mean:');
      console.error('   1. Payment was never created');
      console.error('   2. Payment was created with a different merchant_oid format');
      console.error('   3. Payment was already processed and status changed');
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
      
      // Debug: Vehicle data içeriğini logla
      if (saleData.vehicle) {
        console.log('🔍 Vehicle data details:', JSON.stringify(saleData.vehicle, null, 2));
        console.log('🔍 Vehicle plate:', saleData.vehicle.plate);
        console.log('🔍 Vehicle plate exists?', !!saleData.vehicle.plate);
      }
      
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
            // Yeni müşteri oluştur (birth_date boş string ise MySQL DATE hatası önlenir)
            const bd = saleData.customer.birth_date;
            const birthDate = (bd != null && String(bd).trim() !== '') ? saleData.customer.birth_date : null;
            customer = queryRunner.manager.create(Customer, {
              is_corporate: saleData.customer.is_corporate,
              tc_vkn: saleData.customer.tc_vkn,
              name: saleData.customer.name,
              surname: saleData.customer.surname,
              tax_office: saleData.customer.tax_office,
              birth_date: birthDate,
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
        // Plate kontrolü - plate varsa veya vehicle objesi varsa devam et
        // Plate boşsa, registration_number ve registration_serial'den plate oluştur
        let vehiclePlate = saleData.vehicle?.plate || saleData.vehicle?.plate_number || saleData.vehicle?.plaka;
        
        // Eğer plate boşsa ama registration bilgileri varsa, plate oluştur
        if (!vehiclePlate && saleData.vehicle?.registration_serial && saleData.vehicle?.registration_number) {
          vehiclePlate = `${saleData.vehicle.registration_serial} ${saleData.vehicle.registration_number}`;
          console.log(`⚠️ Plate boş, registration bilgilerinden plate oluşturuldu: ${vehiclePlate}`);
        }
        
        if (vehiclePlate || saleData.vehicle) {
          // Eğer hala plate yoksa ama vehicle objesi varsa, hata ver
          if (!vehiclePlate) {
            console.error('❌ Vehicle object exists but plate is missing!');
            console.error('Vehicle data:', JSON.stringify(saleData.vehicle, null, 2));
            throw new AppError(400, 'Vehicle plate not found in payment details. Vehicle data: ' + JSON.stringify(saleData.vehicle));
          }
          // Mevcut aracı kontrol et
          const plateToSearch = vehiclePlate.toUpperCase();
          const existingVehicle = await this.vehicleRepository.findOne({
            where: { plate: plateToSearch }
          });

          if (existingVehicle) {
            vehicle = existingVehicle;
          } else {
            // Yeni araç oluştur
            const isMotorcycle = saleData.vehicle.vehicle_type === 'Motosiklet';
            const plateValue = vehiclePlate || saleData.vehicle.plate || saleData.vehicle.plate_number || saleData.vehicle.plaka;
            if (!plateValue) {
              throw new AppError(400, 'Vehicle plate is required but not found in payment details');
            }
            
            const vehicleData: any = {
              customer_id: customer.id,
              agency_id: saleData.agency_id || undefined,
              branch_id: saleData.branch_id || undefined,
              vehicle_type: saleData.vehicle.vehicle_type,
              is_foreign_plate: saleData.vehicle.is_foreign_plate || false,
              plate: plateValue.toUpperCase(),
              registration_serial: saleData.vehicle.registration_serial?.toUpperCase() || undefined,
              registration_number: saleData.vehicle.registration_number || undefined,
              model_year: saleData.vehicle.model_year,
              usage_type: saleData.vehicle.usage_type as any,
              brand_name: saleData.vehicle.brand_name || undefined,
              model_name: saleData.vehicle.model_name || undefined,
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

        // 3. Satış oluştur — tarihler initiate'te çözülmüş olmalı; yoksa varsayılan
        const policyNumber = `POL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const lockedStart = saleData.sale?.start_date;
        const lockedEnd = saleData.sale?.end_date;
        const policyDates =
          lockedStart && lockedEnd
            ? { start_date: lockedStart, end_date: lockedEnd }
            : resolvePolicyDates(lockedStart);
        sale = queryRunner.manager.create(Sale, {
          customer_id: customer.id,
          vehicle_id: vehicle.id,
          package_id: saleData.sale.package_id,
          price: saleData.sale.price,
          commission: saleData.sale.commission || 0,
          branch_commission: saleData.sale.branch_commission || null,
          agency_commission: saleData.sale.agency_commission || null,
          start_date: policyDates.start_date,
          end_date: policyDates.end_date,
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

    // Ödeme tutarını parse et (kuruş cinsinden gelir, TL'ye çevir)
    // Eğer callback'te total_amount yoksa veya 0 ise, payment_details'ten al
    let totalAmount = callbackData.total_amount && parseFloat(callbackData.total_amount) > 0
      ? parseFloat(callbackData.total_amount) / 100
      : (payment.payment_details?.sale_data?.sale?.price || payment.amount || 0);
    
    const paymentAmount = callbackData.payment_amount 
      ? parseFloat(callbackData.payment_amount) / 100 
      : totalAmount;

    // Payment status'u kontrol et ve güncelle
    const wasAlreadyCompleted = payment.status === PaymentStatus.COMPLETED;
    
    if (callbackData.status === 'success') {
      // Ödeme başarılı - Payment status'u güncelle (eğer henüz COMPLETED değilse)
      const paymentWasJustCompleted = payment.status !== PaymentStatus.COMPLETED;
      
      if (paymentWasJustCompleted) {
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

        // Ödeme kesin olarak kaydedildi
        await this.paymentRepository.save(payment);
        console.log('✅ Payment status updated to COMPLETED - Ödeme kesin olarak alındı');
      } else {
        console.log('ℹ️ Payment already COMPLETED, skipping status update');
      }
      
      // ÖNEMLİ: SMS sadece ödeme kesin olarak alındıktan sonra gönderilir
      // Payment status COMPLETED olduktan ve kaydedildikten sonra SMS gönder
      // Ödeme kesin olarak alındığı için SMS gönderilebilir
      if (payment.status === PaymentStatus.COMPLETED && sale) {
        console.log('📱 Ödeme kesin olarak alındı - SMS gönderimi başlatılıyor...');
        console.log('   Payment Status: COMPLETED (Ödeme kesin olarak alındı)');
        console.log('   Sale ID:', sale.id);
        console.log('   Sale customer_id:', sale.customer_id);
        
        try {
          const { SmsService } = await import('./SmsService');
          const smsService = new SmsService();
          
          // Customer bilgisini al (sale.customer relation'ından veya customer_id'den)
          let customer = sale.customer;
          if (!customer && sale.customer_id) {
            console.log('   Customer relation yüklenmemiş, customer_id ile yükleniyor...');
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
            const frontendUrl = process.env.FRONTEND_URL || 'https://cozum.net';
            const pdfUrl = `${frontendUrl}/pdf/sale/${sale.id}`;
            
            const smsMessage = `Sayın ${customerName}, ${packageName} paketiniz başarıyla oluşturuldu. Satış No: ${sale.policy_number}, Başlangıç: ${startDate}, Bitiş: ${endDate}. Sözleşme: ${pdfUrl} 7/24 Destek: 0850 304 54 40`;
            console.log('📱 Ödeme kesin olarak alındı - SMS gönderiliyor:', customer.phone);
            await smsService.sendSingleSms(customer.phone, smsMessage);
            console.log('✅ SMS başarıyla gönderildi (Ödeme kesin olarak alındıktan sonra)');
          } else {
            console.log('⚠️ SMS gönderilemedi: Customer veya phone bulunamadı');
          }
        } catch (error: any) {
          console.error('❌ SMS gönderme hatası:', error.message);
        }
      } else {
        if (payment.status !== PaymentStatus.COMPLETED) {
          console.log('⚠️ SMS gönderilemedi: Ödeme henüz kesin olarak alınmadı (Status:', payment.status, ')');
        } else if (!sale) {
          console.log('⚠️ SMS gönderilemedi: Sale bulunamadı');
        }
      }
      
      return { success: true, message: 'Payment completed successfully' };
    } else {
      // Ödeme başarısız - payment kaydını sil (hiçbir kayıt oluşturulmadı)
      await this.paymentRepository.remove(payment);
      
      return { success: true, message: 'Payment failed - no records created' };
    }
  }

  /**
   * Frontend'den döndüğünde payment'ı kontrol edip sale oluşturmayı tetikler
   * Bu metod iframe'den döndüğünde anında sale oluşturmayı sağlar
   */
  async checkAndCreateSaleFromPayment(merchantOid: string): Promise<{ payment: Payment | null; sale: Sale | null; created: boolean }> {
    console.log('🔄 Checking payment and creating sale if needed for merchant_oid:', merchantOid);
    
    // Payment'ı bul (aynı sorgu mantığını kullan)
    let payment = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.type = :type', { type: PaymentType.PAYTR })
      .andWhere(
        `(
          payment.payment_details IS NOT NULL AND (
            JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.sanitized_merchant_oid')) = :oid OR
            JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.temp_merchant_oid')) = :oid OR
            JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.paytr_sent_merchant_oid')) = :oid
          )
        ) OR payment.transaction_id LIKE :transactionId`,
        { 
          oid: merchantOid,
          transactionId: `PAYTR_PENDING_${merchantOid}_%`
        }
      )
      .orderBy('payment.created_at', 'DESC')
      .getOne();
    
    // Eğer bulunamazsa, sanitize edilmiş versiyonu dene
    if (!payment) {
      const sanitizedOid = merchantOid.replace(/[^a-zA-Z0-9]/g, '');
      if (sanitizedOid !== merchantOid) {
        payment = await this.paymentRepository
          .createQueryBuilder('payment')
          .where('payment.type = :type', { type: PaymentType.PAYTR })
          .andWhere(
            `(
              payment.payment_details IS NOT NULL AND (
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.sanitized_merchant_oid')) = :oid OR
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.temp_merchant_oid')) = :oid OR
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.paytr_sent_merchant_oid')) = :oid
              )
            ) OR payment.transaction_id LIKE :transactionId`,
            { 
              oid: sanitizedOid,
              transactionId: `PAYTR_PENDING_${sanitizedOid}_%`
            }
          )
          .orderBy('payment.created_at', 'DESC')
          .getOne();
      }
    }
    
    // Eğer hala bulunamazsa, timestamp'e göre de arama yap (temp1767605159617s5eblp formatı için)
    if (!payment && merchantOid.startsWith('temp')) {
      console.log('🔍 Trying timestamp-based search in checkAndCreateSaleFromPayment...');
      // temp1767605159617s5eblp formatından timestamp'i çıkar (temp'den sonraki sayılar)
      const timestampMatch = merchantOid.match(/^temp(\d+)/);
      if (timestampMatch && timestampMatch[1]) {
        const timestamp = timestampMatch[1];
        console.log('🔍 Extracted timestamp:', timestamp);
        
        // Timestamp'e göre arama yap - transaction_id'de veya merchant_oid'lerde bu timestamp var mı?
        payment = await this.paymentRepository
          .createQueryBuilder('payment')
          .where('payment.type = :type', { type: PaymentType.PAYTR })
          .andWhere(
            `(
              payment.payment_details IS NOT NULL AND (
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.sanitized_merchant_oid')) LIKE :timestampPattern OR
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.temp_merchant_oid')) LIKE :timestampPattern OR
                JSON_UNQUOTE(JSON_EXTRACT(payment.payment_details, '$.paytr_sent_merchant_oid')) LIKE :timestampPattern
              )
            ) OR payment.transaction_id LIKE :timestampPattern`,
            { 
              timestampPattern: `%${timestamp}%`
            }
          )
          .orderBy('payment.created_at', 'DESC')
          .getOne();
        
        if (payment) {
          console.log('✅ Payment found by timestamp in checkAndCreateSaleFromPayment:', payment.id);
        }
      }
    }
    
    // Eğer hala bulunamazsa, daha geniş bir arama yap (son 100 payment)
    if (!payment) {
      console.log('⚠️ Payment still not found, checking all recent PayTR payments...');
      
      const allRecentPayments = await this.paymentRepository
        .createQueryBuilder('payment')
        .where('payment.type = :type', { type: PaymentType.PAYTR })
        .orderBy('payment.created_at', 'DESC')
        .limit(100)
        .getMany();
      
      console.log(`📊 Found ${allRecentPayments.length} recent PayTR payments`);
      
      // Callback'te gelen merchant_oid ile eşleşen payment'ı ara
      // Önce merchant_oid'yi normalize et (alt çizgileri kaldır)
      const normalizedMerchantOid = merchantOid.replace(/_/g, '');
      for (const p of allRecentPayments) {
        const storedSanitized = p.payment_details?.sanitized_merchant_oid;
        const storedTemp = p.payment_details?.temp_merchant_oid;
        const storedPaytrSent = p.payment_details?.paytr_sent_merchant_oid;
        const transactionId = p.transaction_id;
        
        // Tüm değerleri normalize et (alt çizgileri kaldır)
        const normalizedSanitized = storedSanitized?.replace(/_/g, '') || '';
        const normalizedTemp = storedTemp?.replace(/_/g, '') || '';
        const normalizedPaytrSent = storedPaytrSent?.replace(/_/g, '') || '';
        const normalizedTransactionId = transactionId?.replace(/_/g, '') || '';
        
        // Eşleşme kontrolü - normalize edilmiş değerlerle karşılaştır
        const matchesSanitized = normalizedSanitized === normalizedMerchantOid || normalizedSanitized.includes(normalizedMerchantOid) || normalizedMerchantOid.includes(normalizedSanitized);
        const matchesTemp = normalizedTemp === normalizedMerchantOid || normalizedTemp.includes(normalizedMerchantOid) || normalizedMerchantOid.includes(normalizedTemp);
        const matchesPaytrSent = normalizedPaytrSent === normalizedMerchantOid || normalizedPaytrSent.includes(normalizedMerchantOid) || normalizedMerchantOid.includes(normalizedPaytrSent);
        const matchesTransaction = normalizedTransactionId.includes(normalizedMerchantOid) || normalizedMerchantOid.includes(normalizedTransactionId);
        
        if (matchesSanitized || matchesTemp || matchesPaytrSent || matchesTransaction) {
          console.log(`✅ MATCH FOUND in checkAndCreateSaleFromPayment! Payment ID: ${p.id}, Status: ${p.status}`);
          console.log(`   Original merchant_oid: ${merchantOid}, Normalized: ${normalizedMerchantOid}`);
          console.log(`   Matched values: sanitized=${storedSanitized}, temp=${storedTemp}, paytr_sent=${storedPaytrSent}`);
          payment = p;
          break;
        }
      }
    }
    
    if (!payment) {
      console.log('❌ Payment not found for merchant_oid:', merchantOid);
      return { payment: null, sale: null, created: false };
    }
    
    console.log('✅ Payment found:', payment.id, 'Status:', payment.status);
    
    // Sale'ı kontrol et
    let sale = payment.sale_id ? await this.saleRepository.findOne({
      where: { id: payment.sale_id },
      relations: ['agency', 'package', 'customer'],
    }) : null;
    
    // Eğer sale zaten varsa, döndür
    if (sale) {
      console.log('✅ Sale already exists:', sale.id);
      return { payment, sale, created: false };
    }
    
    // Eğer payment PENDING veya COMPLETED ise ve sale yoksa, sale oluştur
    if ((payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.COMPLETED) && payment.payment_details?.sale_data) {
      console.log('🔄 Creating sale from payment_details...');
      
      const saleData = payment.payment_details.sale_data;
      
      // Transaction başlat
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      
      try {
        // handlePaytrCallback'teki sale oluşturma mantığını kullan
        // 1. Müşteri oluştur veya bul
        let customer: Customer;
        if (saleData.customer?.tc_vkn) {
          const existingCustomer = await this.customerRepository.findOne({
            where: { tc_vkn: saleData.customer.tc_vkn }
          });
          
          if (existingCustomer) {
            customer = existingCustomer;
          } else {
            // birth_date boş string ise NULL yap (MySQL DATE boş string kabul etmez)
            const bd = saleData.customer.birth_date;
            const birthDate = (bd != null && String(bd).trim() !== '') ? saleData.customer.birth_date : null;
            customer = queryRunner.manager.create(Customer, {
              is_corporate: saleData.customer.is_corporate,
              tc_vkn: saleData.customer.tc_vkn,
              name: saleData.customer.name,
              surname: saleData.customer.surname,
              tax_office: saleData.customer.tax_office,
              birth_date: birthDate,
              email: saleData.customer.email,
              phone: saleData.customer.phone,
              address: saleData.customer.address,
            });
            customer = await queryRunner.manager.save(customer);
          }
        } else {
          throw new AppError(400, 'Customer data not found in payment details');
        }
        
        // 2. Araç oluştur veya bul
        let vehicle: Vehicle | undefined = undefined;
        let vehiclePlate = saleData.vehicle?.plate || saleData.vehicle?.plate_number || saleData.vehicle?.plaka;
        
        // Eğer plate boşsa ama registration bilgileri varsa, plate oluştur
        if (!vehiclePlate && saleData.vehicle?.registration_serial && saleData.vehicle?.registration_number) {
          vehiclePlate = `${saleData.vehicle.registration_serial} ${saleData.vehicle.registration_number}`;
          console.log(`⚠️ Plate boş, registration bilgilerinden plate oluşturuldu: ${vehiclePlate}`);
        }
        
        if (vehiclePlate) {
          const plateToSearch = vehiclePlate.toUpperCase();
          const existingVehicle = await this.vehicleRepository.findOne({
            where: { plate: plateToSearch }
          });
          
          if (existingVehicle) {
            vehicle = existingVehicle;
          } else {
            const isMotorcycle = saleData.vehicle.vehicle_type === 'Motosiklet';
            const vehicleData: any = {
              customer_id: customer.id,
              agency_id: saleData.agency_id || undefined,
              branch_id: saleData.branch_id || undefined,
              vehicle_type: saleData.vehicle.vehicle_type,
              is_foreign_plate: saleData.vehicle.is_foreign_plate || false,
              plate: plateToSearch,
              registration_serial: saleData.vehicle.registration_serial?.toUpperCase() || undefined,
              registration_number: saleData.vehicle.registration_number || undefined,
              model_year: saleData.vehicle.model_year,
              usage_type: saleData.vehicle.usage_type as any,
              brand_name: saleData.vehicle.brand_name || undefined,
              model_name: saleData.vehicle.model_name || undefined,
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
        }
        
        // 3. Sale oluştur — tarihler initiate'te çözülmüş olmalı; yoksa varsayılan
        const policyNumber = `POL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const lockedStart = saleData.sale?.start_date;
        const lockedEnd = saleData.sale?.end_date;
        const policyDates =
          lockedStart && lockedEnd
            ? { start_date: lockedStart, end_date: lockedEnd }
            : resolvePolicyDates(lockedStart);
        const saleEntity = queryRunner.manager.create(Sale, {
          customer_id: customer.id,
          vehicle_id: vehicle?.id,
          agency_id: saleData.agency_id || undefined,
          branch_id: saleData.branch_id || undefined,
          package_id: saleData.sale.package_id,
          price: saleData.sale.price || saleData.sale.total_amount || 0, // price zorunlu alan
          total_amount: saleData.sale.total_amount || saleData.sale.price || 0,
          commission: saleData.sale.commission || 0,
          branch_commission: saleData.sale.branch_commission || null,
          agency_commission: saleData.sale.agency_commission || null,
          start_date: policyDates.start_date,
          end_date: policyDates.end_date,
          policy_number: policyNumber,
          status: saleData.sale.status || 'COMPLETED',
          payment_method: 'PAYTR',
          notes: saleData.sale.notes || undefined,
          user_id: saleData.user_id || undefined,
        });
        
        sale = await queryRunner.manager.save(saleEntity);
        
        // 4. Payment'ı sale'a bağla
        payment.sale_id = sale.id;
        if (payment.status === PaymentStatus.PENDING) {
          payment.status = PaymentStatus.COMPLETED;
        }
        await queryRunner.manager.save(payment);
        
        // Transaction'ı commit et
        await queryRunner.commitTransaction();
        
        console.log('✅ Sale created successfully:', sale.id);
        return { payment, sale, created: true };
      } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error('❌ Error creating sale from payment:', error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    }
    
    return { payment, sale: null, created: false };
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

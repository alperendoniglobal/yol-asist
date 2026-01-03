import { AppDataSource } from '../config/database';
import { Payment } from '../entities/Payment';
import { Agency } from '../entities/Agency';
import { Sale } from '../entities/Sale';
import { Customer } from '../entities/Customer';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { PaymentType, PaymentStatus } from '../types/enums';
import { PayTRService } from './PayTRService';

export class PaymentService {
  private paymentRepository = AppDataSource.getRepository(Payment);
  private agencyRepository = AppDataSource.getRepository(Agency);
  private saleRepository = AppDataSource.getRepository(Sale);
  private customerRepository = AppDataSource.getRepository(Customer);
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
  async getPaytrToken(saleId: string, req: any, options?: {
    merchantOkUrl?: string;
    merchantFailUrl?: string;
    noInstallment?: number;
    maxInstallment?: number;
  }) {
    const sale = await this.saleRepository.findOne({
      where: { id: saleId },
      relations: ['customer', 'vehicle', 'agency', 'package'],
    });

    if (!sale) {
      throw new AppError(404, 'Sale not found');
    }

    // Customer veya UserCustomer kontrolü
    if (!sale.customer_id && !sale.user_customer_id) {
      throw new AppError(404, 'Customer not found');
    }

    const customer = sale.customer_id
      ? await this.customerRepository.findOne({
          where: { id: sale.customer_id },
        })
      : null;

    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }

    // Sistem kaydı kontrolü - agency_id yoksa ödeme alınamaz
    if (!sale.agency_id) {
      throw new AppError(400, 'Sistem kayıtları için ödeme işlemi yapılamaz. Lütfen bir acenteye atayın.');
    }

    // Kullanıcı IP adresini al
    const userIp = this.paytrService.getUserIp(req);

    // Ödeme tutarını kuruş cinsine çevir (100 ile çarp)
    // sale.price string olarak gelebilir, number'a çevir
    const salePrice = typeof sale.price === 'string' ? parseFloat(sale.price) : (sale.price || 0);
    const paymentAmount = Math.round(salePrice * 100);

    // Sepet içeriği oluştur
    const basketItems = [
      {
        name: sale.package?.name || 'Paket',
        price: salePrice, // Number olarak gönder
        quantity: 1,
      },
    ];
    const userBasket = this.paytrService.createBasket(basketItems);

    // merchant_ok_url ve merchant_fail_url'e sale_id'yi query parameter olarak ekle
    const baseOkUrl = options?.merchantOkUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success`;
    const baseFailUrl = options?.merchantFailUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/fail`;
    const merchantOkUrl = `${baseOkUrl}${baseOkUrl.includes('?') ? '&' : '?'}sale_id=${saleId}`;
    const merchantFailUrl = `${baseFailUrl}${baseFailUrl.includes('?') ? '&' : '?'}sale_id=${saleId}`;

    // PayTR token al
    const tokenResult = await this.paytrService.getToken({
      merchantOid: saleId,
      email: customer.email || 'customer@example.com',
      paymentAmount: paymentAmount,
      currency: 'TL',
      userBasket: userBasket,
      userIp: userIp,
      userName: `${customer.name} ${customer.surname}`,
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
      if (process.env.NODE_ENV === 'development' && !callbackData.hash) {
        console.warn('Hash validation skipped in development mode (no hash provided)');
      } else {
        throw new AppError(400, 'Invalid hash - notification rejected');
      }
    }

    // Sale'ı bul (merchant_oid = sale_id, ama PayTR'den gelen merchant_oid tire içermez)
    // UUID formatına geri çevir: 8-4-4-4-12 karakter grupları
    const sanitizedOid = callbackData.merchant_oid;
    const uuidFormat = `${sanitizedOid.substring(0, 8)}-${sanitizedOid.substring(8, 12)}-${sanitizedOid.substring(12, 16)}-${sanitizedOid.substring(16, 20)}-${sanitizedOid.substring(20)}`;
    
    const sale = await this.saleRepository.findOne({
      where: { id: uuidFormat },
      relations: ['agency'],
    });

    if (!sale) {
      throw new AppError(404, 'Sale not found');
    }

    // Mevcut ödeme kaydını kontrol et (idempotent işlem için)
    let payment = await this.paymentRepository.findOne({
      where: { sale_id: uuidFormat },
      order: { created_at: 'DESC' },
    });

    // Eğer ödeme zaten onaylandıysa veya iptal edildiyse, sadece OK döndür
    if (payment && (payment.status === PaymentStatus.COMPLETED || payment.status === PaymentStatus.FAILED)) {
      return { success: true, message: 'Payment already processed' };
    }

    // Ödeme tutarını parse et (kuruş cinsinden gelir, TL'ye çevir)
    const totalAmount = parseFloat(callbackData.total_amount) / 100;
    const paymentAmount = callbackData.payment_amount 
      ? parseFloat(callbackData.payment_amount) / 100 
      : totalAmount;

    if (callbackData.status === 'success') {
      // Ödeme başarılı
      if (!payment) {
        // Yeni ödeme kaydı oluştur
        payment = this.paymentRepository.create({
          sale_id: uuidFormat,
          agency_id: sale.agency_id || undefined,
          amount: totalAmount,
          type: PaymentType.PAYTR,
          status: PaymentStatus.COMPLETED,
          transaction_id: `PAYTR_${callbackData.merchant_oid}_${Date.now()}`,
          payment_details: {
            paytr_response: callbackData,
            total_amount: totalAmount,
            payment_amount: paymentAmount,
            payment_type: callbackData.payment_type,
            currency: callbackData.currency || 'TL',
            test_mode: callbackData.test_mode === '1',
          },
        });
      } else {
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
      }

      await this.paymentRepository.save(payment);
      return { success: true, message: 'Payment completed successfully' };
    } else {
      // Ödeme başarısız
      if (!payment) {
        payment = this.paymentRepository.create({
          sale_id: uuidFormat,
          agency_id: sale.agency_id || undefined,
          amount: paymentAmount,
          type: PaymentType.PAYTR,
          status: PaymentStatus.FAILED,
          transaction_id: `PAYTR_FAILED_${callbackData.merchant_oid}_${Date.now()}`,
          payment_details: {
            paytr_response: callbackData,
            failed_reason_code: callbackData.failed_reason_code,
            failed_reason_msg: callbackData.failed_reason_msg,
            payment_amount: paymentAmount,
            currency: callbackData.currency || 'TL',
            test_mode: callbackData.test_mode === '1',
          },
        });
      } else {
        payment.status = PaymentStatus.FAILED;
        payment.payment_details = {
          ...payment.payment_details,
          paytr_response: callbackData,
          failed_reason_code: callbackData.failed_reason_code,
          failed_reason_msg: callbackData.failed_reason_msg,
        };
      }

      await this.paymentRepository.save(payment);
      return { success: true, message: 'Payment failed - recorded' };
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
    if (payment.type === PaymentType.BALANCE) {
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

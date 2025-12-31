import { AppDataSource } from '../config/database';
import { Payment } from '../entities/Payment';
import { Agency } from '../entities/Agency';
import { Sale } from '../entities/Sale';
import { Customer } from '../entities/Customer';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { PaymentType, PaymentStatus } from '../types/enums';
import { IyzicoService } from './IyzicoService';

export class PaymentService {
  private paymentRepository = AppDataSource.getRepository(Payment);
  private agencyRepository = AppDataSource.getRepository(Agency);
  private saleRepository = AppDataSource.getRepository(Sale);
  private customerRepository = AppDataSource.getRepository(Customer);
  private iyzicoService = new IyzicoService();

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

  async processIyzico(saleId: string, paymentData: any) {
    const sale = await this.saleRepository.findOne({
      where: { id: saleId },
      relations: ['customer', 'vehicle', 'agency'],
    });

    if (!sale) {
      throw new AppError(404, 'Sale not found');
    }

    // Customer veya UserCustomer kontrolü
    // Sale'da customer_id veya user_customer_id olabilir
    if (!sale.customer_id && !sale.user_customer_id) {
      throw new AppError(404, 'Customer not found');
    }

    const customer = sale.customer_id
      ? await this.customerRepository.findOne({
          where: { id: sale.customer_id },
        })
      : null;

    // UserCustomer için ödeme henüz desteklenmiyor bu service'de
    // UserCustomerService.purchase() içinden yapılıyor
    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }

    // Prepare Iyzico payment request
    const iyzicoRequest = {
      price: paymentData.amount,
      currency: 'TRY',
      conversationId: `SALE_${saleId}_${Date.now()}`,
      buyer: {
        id: customer.id,
        name: customer.name,
        surname: customer.surname,
        email: customer.email || 'customer@example.com',
        phone: customer.phone,
      },
      shippingAddress: {
        contactName: `${customer.name} ${customer.surname}`,
        city: 'Istanbul',
        country: 'Turkey',
        address: customer.address || 'Address not provided',
      },
      billingAddress: {
        contactName: `${customer.name} ${customer.surname}`,
        city: 'Istanbul',
        country: 'Turkey',
        address: customer.address || 'Address not provided',
      },
      basketItems: [
        {
          id: sale.package_id,
          name: 'Sigorta Policesi',
          category1: 'Insurance',
          itemType: 'PHYSICAL',
          price: paymentData.amount,
        },
      ],
      paymentCard: {
        cardHolderName: paymentData.cardHolderName || 'Test User',
        cardNumber: paymentData.cardNumber.replace(/\s/g, ''),
        expireMonth: paymentData.expireMonth,
        expireYear: paymentData.expireYear,
        cvc: paymentData.cvc,
      },
      installment: paymentData.installment || 1,
    };

    // Sistem kaydı kontrolü - agency_id yoksa ödeme alınamaz
    if (!sale.agency_id) {
      throw new AppError(400, 'Sistem kayıtları için ödeme işlemi yapılamaz. Lütfen bir acenteye atayın.');
    }

    // Process payment with Iyzico
    const iyzicoResponse = await this.iyzicoService.processPayment(iyzicoRequest);

    // Create payment record
    const payment = this.paymentRepository.create({
      sale_id: saleId,
      agency_id: sale.agency_id, // Artık kesinlikle string (null değil)
      amount: paymentData.amount,
      type: PaymentType.IYZICO,
      status: iyzicoResponse.status === 'success' 
        ? PaymentStatus.COMPLETED 
        : PaymentStatus.FAILED,
      transaction_id: iyzicoResponse.paymentId || `IYZICO_${Date.now()}`,
      payment_details: {
        iyzicoResponse,
        cardLastFour: paymentData.cardNumber.slice(-4),
        installment: paymentData.installment || 1,
      },
    });

    await this.paymentRepository.save(payment);

    // If payment failed, throw error
    if (iyzicoResponse.status !== 'success') {
      throw new AppError(400, iyzicoResponse.errorMessage || 'Payment failed');
    }

    return payment;
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

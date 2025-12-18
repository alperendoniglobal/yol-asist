import { AppDataSource } from '../../config/database';
import { Payment } from '../../entities/Payment';
import { Sale } from '../../entities/Sale';
import { PaymentType, PaymentStatus } from '../../types/enums';

export const seedPayments = async () => {
  const paymentRepository = AppDataSource.getRepository(Payment);
  const saleRepository = AppDataSource.getRepository(Sale);

  const sales = await saleRepository.find({
    relations: ['agency'],
  });

  if (sales.length === 0) {
    console.log('⚠ No sales found. Please seed sales first.');
    return [];
  }

  const createdPayments = [];

  // Create payments for 80% of sales
  const salesToPay = sales.slice(0, Math.floor(sales.length * 0.8));

  for (const sale of salesToPay) {
    // agency_id null kontrolü
    if (!sale.agency_id) continue;

    // Random payment type (60% Iyzico, 40% Balance)
    const isIyzico = Math.random() < 0.6;
    const paymentType = isIyzico ? PaymentType.IYZICO : PaymentType.BALANCE;

    // 95% completed, 5% pending
    const isCompleted = Math.random() < 0.95;
    const status = isCompleted ? PaymentStatus.COMPLETED : PaymentStatus.PENDING;

    const paymentData = {
      sale_id: sale.id,
      agency_id: sale.agency_id as string,
      amount: sale.price,
      type: paymentType,
      status: status,
      transaction_id: `${paymentType}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      payment_details: {
        payment_method: paymentType,
        transaction_date: new Date().toISOString(),
        ...(isIyzico && {
          card_family: ['World', 'Maximum', 'Axess', 'Bonus'][Math.floor(Math.random() * 4)],
          card_type: 'CREDIT_CARD',
          installment: [1, 3, 6, 9, 12][Math.floor(Math.random() * 5)],
        }),
      },
    };

    const payment = paymentRepository.create(paymentData);
    const saved = await paymentRepository.save(payment);
    createdPayments.push(saved);
    console.log(`✓ Payment created: ${paymentData.transaction_id} (${paymentType})`);
  }

  console.log(`✓ Total payments created: ${createdPayments.length}`);
  return createdPayments;
};

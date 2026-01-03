import { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const payments = await this.paymentService.getAll(req.tenantFilter);
    successResponse(res, payments, 'Payments retrieved successfully');
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const payment = await this.paymentService.getById(id);
    successResponse(res, payment, 'Payment retrieved successfully');
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const paymentData = {
      ...req.body,
      agency_id: req.user?.agency_id || req.body.agency_id,
    };
    const payment = await this.paymentService.create(paymentData);
    successResponse(res, payment, 'Payment created successfully', 201);
  });

  // PayTR token alma (iFrame için)
  getPaytrToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sale_id, merchant_ok_url, merchant_fail_url, no_installment, max_installment } = req.body;
    const result = await this.paymentService.getPaytrToken(sale_id, req, {
      merchantOkUrl: merchant_ok_url,
      merchantFailUrl: merchant_fail_url,
      noInstallment: no_installment,
      maxInstallment: max_installment,
    });
    successResponse(res, result, 'PayTR token retrieved successfully', 200);
  });

  // PayTR bildirim callback (public endpoint - auth gerektirmez)
  handlePaytrCallback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // PayTR callback'ten gelen POST verilerini al
    const callbackData = {
      merchant_oid: req.body.merchant_oid,
      status: req.body.status,
      total_amount: req.body.total_amount,
      hash: req.body.hash,
      failed_reason_code: req.body.failed_reason_code,
      failed_reason_msg: req.body.failed_reason_msg,
      test_mode: req.body.test_mode,
      payment_type: req.body.payment_type,
      currency: req.body.currency,
      payment_amount: req.body.payment_amount,
    };

    // Callback işle
    const result = await this.paymentService.handlePaytrCallback(callbackData);

    // PayTR'a "OK" yanıtı döndür (mutlaka "OK" olmalı, başka bir şey döndürülmemeli)
    res.status(200).send('OK');
  });

  // Bakiye ile ödeme işleme - agency_id sale'den alınacak
  processBalance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sale_id, ...paymentData } = req.body;
    const payment = await this.paymentService.processBalance(sale_id, paymentData);
    successResponse(res, payment, 'Balance payment processed successfully', 201);
  });

  refund = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.paymentService.refund(id);
    successResponse(res, result, 'Payment refunded successfully');
  });
}

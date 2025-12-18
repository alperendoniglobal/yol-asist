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

  // Iyzico ödeme işleme - agency_id sale'den alınacak
  processIyzico = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sale_id, ...paymentData } = req.body;
    const payment = await this.paymentService.processIyzico(sale_id, paymentData);
    successResponse(res, payment, 'Iyzico payment processed successfully', 201);
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

import { Request, Response } from 'express';
import { CommissionService } from '../services/CommissionService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class CommissionController {
  private commissionService: CommissionService;

  constructor() {
    this.commissionService = new CommissionService();
  }

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const commissions = await this.commissionService.getAll(req.tenantFilter);
    successResponse(res, commissions, 'Commission requests retrieved successfully');
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const commission = await this.commissionService.getById(id);
    successResponse(res, commission, 'Commission request retrieved successfully');
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const commissionData = {
      ...req.body,
      agency_id: req.user?.agency_id,
    };
    const commission = await this.commissionService.create(commissionData);
    successResponse(res, commission, 'Commission request created successfully', 201);
  });

  approve = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const commission = await this.commissionService.approve(id);
    successResponse(res, commission, 'Commission request approved successfully');
  });

  reject = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    const commission = await this.commissionService.reject(id, reason);
    successResponse(res, commission, 'Commission request rejected successfully');
  });

  markAsPaid = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const commission = await this.commissionService.markAsPaid(id);
    successResponse(res, commission, 'Commission request marked as paid successfully');
  });
}

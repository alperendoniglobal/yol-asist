import { Request, Response } from 'express';
import { StatsService } from '../services/StatsService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class StatsController {
  private statsService: StatsService;

  constructor() {
    this.statsService = new StatsService();
  }

  getDashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Cache'i devre dışı bırak - her zaman güncel veri
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const stats = await this.statsService.getDashboard(req.tenantFilter);
    successResponse(res, stats, 'Dashboard stats retrieved successfully');
  });

  getSalesStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.statsService.getSalesStats(req.tenantFilter);
    successResponse(res, stats, 'Sales stats retrieved successfully');
  });

  getRevenueStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.statsService.getRevenueStats(req.tenantFilter);
    successResponse(res, stats, 'Revenue stats retrieved successfully');
  });

  getCustomerStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.statsService.getCustomerStats(req.tenantFilter);
    successResponse(res, stats, 'Customer stats retrieved successfully');
  });

  getAgencyStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.statsService.getAgencyStats(req.tenantFilter);
    successResponse(res, stats, 'Agency stats retrieved successfully');
  });
}

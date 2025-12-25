import { Request, Response } from 'express';
import { AgencyService } from '../services/AgencyService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class AgencyController {
  private agencyService: AgencyService;

  constructor() {
    this.agencyService = new AgencyService();
  }

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agencies = await this.agencyService.getAll(req.tenantFilter);
    successResponse(res, agencies, 'Agencies retrieved successfully');
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agency = await this.agencyService.getById(id);
    successResponse(res, agency, 'Agency retrieved successfully');
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agency = await this.agencyService.create(req.body);
    successResponse(res, agency, 'Agency created successfully', 201);
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agency = await this.agencyService.update(id, req.body);
    successResponse(res, agency, 'Agency updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.agencyService.delete(id);
    successResponse(res, result, 'Agency deleted successfully');
  });

  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const stats = await this.agencyService.getStats(id);
    successResponse(res, stats, 'Agency stats retrieved successfully');
  });

  getBranchCommissionDistribution = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const distribution = await this.agencyService.getBranchCommissionDistribution(id);
    successResponse(res, distribution, 'Komisyon dağılım raporu başarıyla getirildi');
  });
}

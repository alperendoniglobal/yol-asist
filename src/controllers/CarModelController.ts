import { Request, Response } from 'express';
import { CarModelService } from '../services/CarModelService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class CarModelController {
  private modelService: CarModelService;

  constructor() {
    this.modelService = new CarModelService();
  }

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const models = await this.modelService.getAll(brandId);
    successResponse(res, models, 'Car models retrieved successfully');
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const model = await this.modelService.getById(parseInt(id));
    successResponse(res, model, 'Car model retrieved successfully');
  });

  getByBrand = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { brandId } = req.params;
    const models = await this.modelService.getByBrand(parseInt(brandId));
    successResponse(res, models, 'Car models retrieved successfully');
  });
}


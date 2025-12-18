import { Request, Response } from 'express';
import { CarBrandService } from '../services/CarBrandService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class CarBrandController {
  private brandService: CarBrandService;

  constructor() {
    this.brandService = new CarBrandService();
  }

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const brands = await this.brandService.getAll();
    successResponse(res, brands, 'Car brands retrieved successfully');
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const brand = await this.brandService.getById(parseInt(id));
    successResponse(res, brand, 'Car brand retrieved successfully');
  });
}


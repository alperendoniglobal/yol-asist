import { Request, Response } from 'express';
import { MotorBrandService } from '../services/MotorBrandService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

/**
 * Motor Marka Controller
 * Motosiklet markaları için HTTP endpoint'lerini yönetir
 */
export class MotorBrandController {
  private brandService: MotorBrandService;

  constructor() {
    this.brandService = new MotorBrandService();
  }

  /**
   * GET /motor-brands
   * Tüm motor markalarını getirir
   */
  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const brands = await this.brandService.getAll();
    successResponse(res, brands, 'Motor brands retrieved successfully');
  });

  /**
   * GET /motor-brands/:id
   * ID'ye göre motor markasını getirir
   */
  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const brand = await this.brandService.getById(parseInt(id));
    successResponse(res, brand, 'Motor brand retrieved successfully');
  });
}


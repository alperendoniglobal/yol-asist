import { Request, Response } from 'express';
import { MotorModelService } from '../services/MotorModelService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

/**
 * Motor Model Controller
 * Motosiklet modelleri için HTTP endpoint'lerini yönetir
 */
export class MotorModelController {
  private modelService: MotorModelService;

  constructor() {
    this.modelService = new MotorModelService();
  }

  /**
   * GET /motor-models
   * Tüm motor modellerini getirir
   */
  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const models = await this.modelService.getAll();
    successResponse(res, models, 'Motor models retrieved successfully');
  });

  /**
   * GET /motor-models/brand/:brandId
   * Marka ID'sine göre modelleri getirir
   */
  getByBrandId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { brandId } = req.params;
    const models = await this.modelService.getByBrandId(parseInt(brandId));
    successResponse(res, models, 'Motor models retrieved successfully');
  });

  /**
   * GET /motor-models/:id
   * ID'ye göre motor modelini getirir
   */
  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const model = await this.modelService.getById(parseInt(id));
    successResponse(res, model, 'Motor model retrieved successfully');
  });
}


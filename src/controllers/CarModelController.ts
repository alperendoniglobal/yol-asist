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

    if (!model) {
      res.status(404).json({
        success: false,
        message: 'Car model not found',
        data: null
      });
      return;
    }

    successResponse(res, model, 'Car model retrieved successfully');
  });

  getByBrand = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { brandId } = req.params;
    const models = await this.modelService.getByBrand(parseInt(brandId));
    successResponse(res, models, 'Car models retrieved successfully');
  });

  /** Yeni model oluştur (Sadece SUPER_ADMIN) */
  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const model = await this.modelService.create(req.body);
    successResponse(res, model, 'Car model created successfully', 201);
  });

  /** Model güncelle (Sadece SUPER_ADMIN) */
  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const model = await this.modelService.update(parseInt(id), req.body);
    successResponse(res, model, 'Car model updated successfully');
  });

  /** Model sil (Sadece SUPER_ADMIN; kullanımdaki model silinemez) */
  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.modelService.delete(parseInt(id));
    successResponse(res, result, 'Car model deleted successfully');
  });
}


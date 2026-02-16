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

  /** Yeni marka oluştur (Sadece SUPER_ADMIN) */
  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const brand = await this.brandService.create(req.body);
    successResponse(res, brand, 'Car brand created successfully', 201);
  });

  /** Marka güncelle (Sadece SUPER_ADMIN) */
  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const brand = await this.brandService.update(parseInt(id), req.body);
    successResponse(res, brand, 'Car brand updated successfully');
  });

  /** Marka sil (Sadece SUPER_ADMIN; kullanımdaki marka silinemez) */
  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.brandService.delete(parseInt(id));
    successResponse(res, result, 'Car brand deleted successfully');
  });
}


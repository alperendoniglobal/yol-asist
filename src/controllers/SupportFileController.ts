import { Request, Response } from 'express';
import { SupportFileService } from '../services/SupportFileService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class SupportFileController {
  private fileService: SupportFileService;

  constructor() {
    this.fileService = new SupportFileService();
  }

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sale_id, created_by } = req.query;
    
    const filter: any = {};
    if (sale_id) filter.sale_id = sale_id as string;
    if (created_by) filter.created_by = created_by as string;
    
    // Kullanıcı bilgisini service'e gönder (rol bazlı filtreleme için)
    const files = await this.fileService.getAll(filter, req.user);
    successResponse(res, files, 'Hasar dosyaları başarıyla getirildi');
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const file = await this.fileService.getById(id);
    successResponse(res, file, 'Hasar dosyası başarıyla getirildi');
  });

  getBySaleId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { saleId } = req.params;
    const files = await this.fileService.getBySaleId(saleId);
    successResponse(res, files, 'Hasar dosyaları başarıyla getirildi');
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const fileData = {
      ...req.body,
      created_by: req.user?.id, // Otomatik olarak giriş yapan kullanıcı
    };
    
    const file = await this.fileService.create(fileData);
    successResponse(res, file, 'Hasar dosyası başarıyla oluşturuldu', 201);
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const file = await this.fileService.update(id, req.body);
    successResponse(res, file, 'Hasar dosyası başarıyla güncellendi');
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.fileService.delete(id);
    successResponse(res, result, 'Hasar dosyası başarıyla silindi');
  });
}





import { Request, Response } from 'express';
import { BranchService } from '../services/BranchService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class BranchController {
  private branchService: BranchService;

  constructor() {
    this.branchService = new BranchService();
  }

  // Tum subeleri getir (komisyon bilgileriyle birlikte)
  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Komisyon bilgisi de dahil edilsin mi?
    const includeCommission = req.query.includeCommission === 'true';
    
    let branches;
    if (includeCommission) {
      // Efektif komisyon oranlarıyla birlikte getir
      branches = await this.branchService.getAllWithCommission(req.tenantFilter);
    } else {
      branches = await this.branchService.getAll(req.tenantFilter);
    }
    
    successResponse(res, branches, 'Subeler basariyla getirildi');
  });

  // Sube detaylarini getir
  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const branch = await this.branchService.getById(id);
    successResponse(res, branch, 'Sube basariyla getirildi');
  });

  // Sube detaylari ile performans istatistiklerini getir
  getByIdWithStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const branch = await this.branchService.getByIdWithStats(id);
    successResponse(res, branch, 'Sube detaylari ve istatistikleri basariyla getirildi');
  });

  // Yeni sube olustur
  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const branch = await this.branchService.create(req.body);
    successResponse(res, branch, 'Sube basariyla olusturuldu', 201);
  });

  // Sube guncelle
  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const branch = await this.branchService.update(id, req.body);
    successResponse(res, branch, 'Sube basariyla guncellendi');
  });

  // Sube sil
  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.branchService.delete(id);
    successResponse(res, result, 'Sube basariyla silindi');
  });

  // Şube komisyon oranını güncelle
  // Ana merkez (acente admin) bu endpoint ile şubelerin komisyon oranlarını belirler
  updateCommissionRate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { commission_rate } = req.body;
    
    // commission_rate null olabilir (acente oranı kullanılsın demek)
    const branch = await this.branchService.updateCommissionRate(id, commission_rate);
    successResponse(res, branch, 'Sube komisyon orani basariyla guncellendi');
  });

  // Şubenin komisyon oranını getir
  getCommissionRate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.branchService.getCommissionRate(id);
    successResponse(res, data, 'Komisyon orani basariyla getirildi');
  });
}

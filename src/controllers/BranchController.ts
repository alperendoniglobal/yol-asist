import { Request, Response } from 'express';
import { BranchService } from '../services/BranchService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class BranchController {
  private branchService: BranchService;

  constructor() {
    this.branchService = new BranchService();
  }

  // Tum subeleri getir (komisyon bilgileriyle birlikte). agency_id query ile acente bazlı filtreleme (Super Admin için).
  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const includeCommission = req.query.includeCommission === 'true';
    const agencyId = req.query.agency_id as string | undefined;
    const filter = { ...req.tenantFilter, ...(agencyId && { agency_id: agencyId }) };

    let branches;
    if (includeCommission) {
      branches = await this.branchService.getAllWithCommission(filter, req.user);
    } else {
      branches = await this.branchService.getAll(filter, req.user);
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
    // AGENCY_ADMIN için seçili broker'ı kullan (req.tenantFilter.agency_id)
    // Eğer body'de agency_id yoksa tenantFilter'dan al
    const branchData = {
      ...req.body,
      agency_id: req.body.agency_id || req.tenantFilter?.agency_id || null,
    };
    const branch = await this.branchService.create(branchData);
    successResponse(res, branch, 'Sube basariyla olusturuldu', 201);
  });

  // Sube guncelle
  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    // SUPER_AGENCY_ADMIN için currentUser'ı gönder (sadece kendi brokerlarının acentelerini düzenleyebilmesi için)
    const branch = await this.branchService.update(id, req.body, req.user);
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

import { Request, Response } from 'express';
import { AgencyService } from '../services/AgencyService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';
import { UserRole } from '../types/enums';

export class AgencyController {
  private agencyService: AgencyService;

  constructor() {
    this.agencyService = new AgencyService();
  }

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // SUPER_AGENCY_ADMIN için currentUser'ı gönder (yönettiği brokerları filtrelemek için)
    const agencies = await this.agencyService.getAll(req.tenantFilter, req.user);
    successResponse(res, agencies, 'Agencies retrieved successfully');
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agency = await this.agencyService.getById(id);
    successResponse(res, agency, 'Agency retrieved successfully');
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agencyData = { ...req.body };
    
    // assigned_to_user_id alanını çıkar (Agency entity'sinde yok, sadece request body'den geliyor)
    const assignedToUserId = agencyData.assigned_to_user_id;
    delete agencyData.assigned_to_user_id;
    
    // Broker'ı oluştur
    const agency = await this.agencyService.create(agencyData);
    
    // SUPER_ADMIN için: assigned_to_user_id varsa o kullanıcıya ata
    if (req.user?.role === UserRole.SUPER_ADMIN && assignedToUserId) {
      await this.agencyService.assignAgencyToUser(agency.id, assignedToUserId);
    }
    // SUPER_AGENCY_ADMIN için: assigned_to_user_id varsa o kullanıcıya ata, yoksa oluşturan kullanıcıya ata
    else if (req.user?.role === UserRole.SUPER_AGENCY_ADMIN) {
      const userIdToAssign = assignedToUserId || req.user.id;
      await this.agencyService.assignAgencyToUser(agency.id, userIdToAssign);
    }
    
    successResponse(res, agency, 'Agency created successfully', 201);
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    // SUPER_AGENCY_ADMIN için currentUser'ı gönder (sadece kendi brokerlarını düzenleyebilmesi için)
    const agency = await this.agencyService.update(id, req.body, req.user);
    successResponse(res, agency, 'Agency updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    // SUPER_AGENCY_ADMIN için currentUser'ı gönder (sadece kendi brokerlarını silebilmesi için)
    const result = await this.agencyService.delete(id, req.user);
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

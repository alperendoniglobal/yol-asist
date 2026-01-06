import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // Tum kullanicilari getir (silinmemis olanlar)
  // Şube yöneticisi sadece kendi şubesindeki kullanıcıları görebilir
  // Acente yöneticisi acenteki tüm kullanıcıları görebilir
  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const users = await this.userService.getAll(req.tenantFilter, req.user);
    successResponse(res, users, 'Kullanicilar basariyla getirildi');
  });

  // Kullanici detaylarini getir
  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = await this.userService.getById(id);
    successResponse(res, user, 'Kullanici basariyla getirildi');
  });

  // Kullanici detaylari ile aktivitelerini getir
  // Acente yoneticisi calisanlarinin islemlerini gormek icin kullanir
  // SUPER_ADMIN için şifre bilgisi de döndürülür
  getByIdWithActivity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = await this.userService.getByIdWithActivity(id, req.user);
    successResponse(res, user, 'Kullanici detaylari ve aktiviteleri basariyla getirildi');
  });

  // Yeni kullanici olustur
  // SUPPORT rolü sadece SUPER_ADMIN tarafından oluşturulabilir
  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // AGENCY_ADMIN için seçili broker'ı kullan (req.tenantFilter.agency_id)
    // Eğer body'de agency_id yoksa veya SUPER_ADMIN değilse tenantFilter'dan al
    const userData = { ...req.body };
    
    // AGENCY_ADMIN için seçili broker'ı kullan
    if (req.tenantFilter?.agency_id && !userData.agency_id) {
      userData.agency_id = req.tenantFilter.agency_id;
    }
    
    // Branch için de aynı mantık
    if (req.tenantFilter?.branch_id && !userData.branch_id) {
      userData.branch_id = req.tenantFilter.branch_id;
    }
    
    const user = await this.userService.create(userData, req.user);
    successResponse(res, user, 'Kullanici basariyla olusturuldu', 201);
  });

  // Kullanici guncelle
  // SUPPORT rolü sadece SUPER_ADMIN tarafından atanabilir veya değiştirilebilir
  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = await this.userService.update(id, req.body, req.user);
    successResponse(res, user, 'Kullanici basariyla guncellendi');
  });

  // Kullaniciyi sil (soft delete)
  // Gercekte silmez, sadece is_deleted = true yapar
  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.userService.delete(id);
    successResponse(res, result, 'Kullanici basariyla silindi');
  });

  // Kullanici durumunu degistir (aktif <-> pasif)
  // Acente yoneticisi calisanlarini aktif/pasif yapabilir
  toggleStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = await this.userService.toggleStatus(id);
    successResponse(res, user, 'Kullanici durumu basariyla degistirildi');
  });

  // Izinleri guncelle
  updatePermissions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { permissions } = req.body;
    const user = await this.userService.updatePermissions(id, permissions);
    successResponse(res, user, 'Izinler basariyla guncellendi');
  });

  // AGENCY_ADMIN kullanıcısına broker atama
  assignAgency = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, agencyId } = req.params;
    const user = await this.userService.assignAgency(id, agencyId);
    successResponse(res, user, 'Broker basariyla atandi');
  });

  // AGENCY_ADMIN kullanıcısından broker kaldırma
  removeAgency = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, agencyId } = req.params;
    const user = await this.userService.removeAgency(id, agencyId);
    successResponse(res, user, 'Broker basariyla kaldirildi');
  });

  // Kullanıcının yönettiği brokerları getir
  getManagedAgencies = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agencies = await this.userService.getManagedAgencies(id);
    successResponse(res, agencies, 'Yonetilen brokerlar basariyla getirildi');
  });
}

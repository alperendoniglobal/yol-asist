import { Request, Response, NextFunction } from 'express';
import { DealerApplicationService } from '../services/DealerApplicationService';
import { AppError } from '../middlewares/errorHandler';
import { DealerApplicationStatus } from '../types/enums';

/**
 * Bayilik Başvuru Controller
 * Bayilik başvurularının yönetimi
 */
export class DealerApplicationController {
  private applicationService = new DealerApplicationService();

  /**
   * Yeni bayilik başvurusu oluştur (Public)
   * POST /api/v1/public/dealer-application
   */
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, surname, email, phone, tc_vkn, company_name, city, district, address, referral_code, password } =
        req.body;

      // Zorunlu alan kontrolleri
      if (!name || !surname || !email || !phone || !tc_vkn || !city || !password) {
        throw new AppError(400, 'Ad, soyad, e-posta, telefon, T.C./Vergi No, şehir ve şifre zorunludur');
      }

      // Email formatı kontrolü
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError(400, 'Geçerli bir e-posta adresi giriniz');
      }

      // Şifre uzunluğu kontrolü
      if (password.length < 8) {
        throw new AppError(400, 'Şifre en az 8 karakter olmalıdır');
      }

      const result = await this.applicationService.create({
        name,
        surname,
        email,
        phone,
        tc_vkn,
        company_name,
        city,
        district,
        address,
        referral_code,
        password,
      });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Başvurunuz alındı. İncelendikten sonra size bilgi verilecektir.',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Tüm başvuruları getir (Super Admin)
   * GET /api/v1/dealer-applications
   */
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as DealerApplicationStatus | undefined;
      const applications = await this.applicationService.getAll({ status });

      res.json({
        success: true,
        data: applications,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Tek bir başvuruyu getir (Super Admin)
   * GET /api/v1/dealer-applications/:id
   */
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const application = await this.applicationService.getById(id);

      res.json({
        success: true,
        data: application,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Başvuruyu onayla (Super Admin)
   * PUT /api/v1/dealer-applications/:id/approve
   */
  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        throw new AppError(401, 'Yetkilendirme hatası');
      }

      const result = await this.applicationService.approve(id, adminUserId, notes);

      res.json({
        success: true,
        data: result,
        message: 'Başvuru onaylandı, acente ve kullanıcı oluşturuldu',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Başvuruyu reddet (Super Admin)
   * PUT /api/v1/dealer-applications/:id/reject
   */
  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        throw new AppError(401, 'Yetkilendirme hatası');
      }

      if (!notes || notes.trim() === '') {
        throw new AppError(400, 'Red sebebi belirtilmelidir');
      }

      const result = await this.applicationService.reject(id, adminUserId, notes);

      res.json({
        success: true,
        data: result,
        message: 'Başvuru reddedildi',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bekleyen başvuru sayısını getir (Super Admin)
   * GET /api/v1/dealer-applications/pending-count
   */
  getPendingCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await this.applicationService.getPendingCount();

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  };
}


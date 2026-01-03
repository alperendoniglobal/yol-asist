import { Request, Response, NextFunction } from 'express';
import { PublicService } from '../services/PublicService';
import { AppError } from '../middlewares/errorHandler';

/**
 * Public Controller
 * Giriş yapmadan erişilebilen public endpoint'ler
 */
export class PublicController {
  private publicService = new PublicService();

  /**
   * Tüm aktif paketleri fiyatsız olarak getir
   * GET /api/v1/public/packages
   */
  getPackages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const packages = await this.publicService.getPackagesWithoutPrice();
      res.json({
        success: true,
        data: packages,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Tek bir paketi fiyatsız olarak getir
   * GET /api/v1/public/packages/:id
   */
  getPackageById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const pkg = await this.publicService.getPackageByIdWithoutPrice(id);
      res.json({
        success: true,
        data: pkg,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Tüm unique hizmet başlıklarını getir (footer için)
   * GET /api/v1/public/services
   */
  getServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const services = await this.publicService.getUniqueServices();
      res.json({
        success: true,
        data: services,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Araba markalarını getir
   * GET /api/v1/public/car-brands
   */
  getCarBrands = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const brands = await this.publicService.getCarBrands();
      res.json({
        success: true,
        data: brands,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Araba modellerini getir
   * GET /api/v1/public/car-models/:brandId
   */
  getCarModels = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const brandId = parseInt(req.params.brandId);
      if (isNaN(brandId)) {
        throw new AppError(400, 'Geçersiz marka ID');
      }
      const models = await this.publicService.getCarModels(brandId);
      res.json({
        success: true,
        data: models,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Motor markalarını getir
   * GET /api/v1/public/motor-brands
   */
  getMotorBrands = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const brands = await this.publicService.getMotorBrands();
      res.json({
        success: true,
        data: brands,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Motor modellerini getir
   * GET /api/v1/public/motor-models/:brandId
   */
  getMotorModels = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const brandId = parseInt(req.params.brandId);
      if (isNaN(brandId)) {
        throw new AppError(400, 'Geçersiz marka ID');
      }
      const models = await this.publicService.getMotorModels(brandId);
      res.json({
        success: true,
        data: models,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * TC Kimlik No kontrolü
   * Sistemde bu TC ile kayıtlı kullanıcı var mı?
   * GET /api/v1/public/check-tc/:tc
   */
  checkTc = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tc } = req.params;

      if (!tc || tc.length < 10) {
        throw new AppError(400, 'Geçerli bir T.C. Kimlik No giriniz');
      }

      const result = await this.publicService.checkTcExists(tc);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Kullanıcı satın alma işlemi
   * POST /api/v1/public/purchase
   */
  processPurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { customer, vehicle, package_id, terms_accepted, merchant_ok_url, merchant_fail_url } = req.body;

      // Zorunlu alan kontrolleri
      if (!customer || !vehicle || !package_id) {
        throw new AppError(400, 'Müşteri, araç ve paket bilgileri zorunludur');
      }

      if (!customer.name || !customer.surname || !customer.tc_vkn || !customer.phone) {
        throw new AppError(400, 'Ad, soyad, T.C./Vergi No ve telefon zorunludur');
      }

      if (!vehicle.plate || !vehicle.model_year || !vehicle.usage_type || !vehicle.vehicle_type) {
        throw new AppError(400, 'Plaka, model yılı, kullanım tipi ve araç türü zorunludur');
      }

      const result = await this.publicService.processPurchase({
        customer,
        vehicle,
        package_id,
        terms_accepted: terms_accepted === true,
        merchantOkUrl: merchant_ok_url,
        merchantFailUrl: merchant_fail_url,
      }, req);

      res.json({
        success: true,
        data: result,
        message: 'PayTR token başarıyla alındı',
      });
    } catch (error) {
      next(error);
    }
  };
}


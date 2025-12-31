import { Request, Response, NextFunction } from 'express';
import { UserCustomerService } from '../services/UserCustomerService';
import { AppError } from '../middlewares/errorHandler';

/**
 * UserCustomerController
 * Bireysel kullanıcılar için API endpoint'leri
 */
export class UserCustomerController {
  private userCustomerService = new UserCustomerService();

  /**
   * Kayıt ol
   * POST /api/v1/user-customer/register
   */
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tc_vkn, name, surname, email, phone, password, city, district, address } = req.body;

      // Zorunlu alan kontrolü
      if (!tc_vkn || !name || !surname || !email || !phone || !password) {
        throw new AppError(400, 'Tüm zorunlu alanları doldurun');
      }

      // TC 11 hane kontrolü
      if (tc_vkn.length !== 11) {
        throw new AppError(400, 'T.C. Kimlik No 11 hane olmalıdır');
      }

      // Şifre minimum uzunluk kontrolü
      if (password.length < 6) {
        throw new AppError(400, 'Şifre en az 6 karakter olmalıdır');
      }

      const result = await this.userCustomerService.register({
        tc_vkn,
        name,
        surname,
        email,
        phone,
        password,
        city,
        district,
        address,
      });

      res.status(201).json({
        success: true,
        message: 'Kayıt başarılı',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Giriş yap
   * POST /api/v1/user-customer/login
   */
  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError(400, 'E-posta ve şifre gerekli');
      }

      const result = await this.userCustomerService.login(email, password);

      res.json({
        success: true,
        message: 'Giriş başarılı',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Token yenile
   * POST /api/v1/user-customer/refresh-token
   */
  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new AppError(400, 'Refresh token gerekli');
      }

      const result = await this.userCustomerService.refreshToken(refreshToken);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Profil bilgilerini getir
   * GET /api/v1/user-customer/profile
   */
  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userCustomerId; // Middleware'den gelen userId

      if (!userId) {
        throw new AppError(401, 'Kimlik doğrulama gerekli');
      }

      const result = await this.userCustomerService.getProfile(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Profil güncelle
   * PUT /api/v1/user-customer/profile
   */
  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userCustomerId;
      const { name, surname, phone, city, district, address } = req.body;

      if (!userId) {
        throw new AppError(401, 'Kimlik doğrulama gerekli');
      }

      const result = await this.userCustomerService.updateProfile(userId, {
        name,
        surname,
        phone,
        city,
        district,
        address,
      });

      res.json({
        success: true,
        message: 'Profil güncellendi',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Şifre değiştir
   * PUT /api/v1/user-customer/change-password
   */
  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userCustomerId;
      const { oldPassword, newPassword } = req.body;

      if (!userId) {
        throw new AppError(401, 'Kimlik doğrulama gerekli');
      }

      if (!oldPassword || !newPassword) {
        throw new AppError(400, 'Mevcut şifre ve yeni şifre gerekli');
      }

      if (newPassword.length < 6) {
        throw new AppError(400, 'Yeni şifre en az 6 karakter olmalıdır');
      }

      const result = await this.userCustomerService.changePassword(userId, oldPassword, newPassword);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Satın alınan paketleri getir
   * GET /api/v1/user-customer/purchases
   */
  getMyPurchases = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userCustomerId;

      if (!userId) {
        throw new AppError(401, 'Kimlik doğrulama gerekli');
      }

      const result = await this.userCustomerService.getMyPurchases(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Araçları getir
   * GET /api/v1/user-customer/vehicles
   */
  getMyVehicles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userCustomerId;

      if (!userId) {
        throw new AppError(401, 'Kimlik doğrulama gerekli');
      }

      const result = await this.userCustomerService.getMyVehicles(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Paket satın al
   * POST /api/v1/user-customer/purchase
   */
  purchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userCustomerId;
      const { package_id, vehicle, card, terms_accepted } = req.body;

      if (!userId) {
        throw new AppError(401, 'Kimlik doğrulama gerekli');
      }

      if (!package_id || !vehicle || !card) {
        throw new AppError(400, 'Paket, araç ve kart bilgileri gerekli');
      }

      const result = await this.userCustomerService.purchase(userId, {
        package_id,
        vehicle,
        card,
        terms_accepted,
      });

      res.json({
        success: true,
        message: 'Satın alma başarılı',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}


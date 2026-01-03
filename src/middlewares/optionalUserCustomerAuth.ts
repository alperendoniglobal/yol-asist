import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { UserCustomer } from '../entities/UserCustomer';
import { config } from '../config';

/**
 * Optional UserCustomer Authentication Middleware
 * Token varsa kullanıcıyı doğrular ve req.userCustomer'a ekler
 * Token yoksa veya geçersizse hata vermez, sadece req.userCustomer undefined kalır
 * Public endpoint'lerde kullanılır - giriş yapmış kullanıcılar için ekstra bilgi döndürmek için
 */
export const optionalUserCustomerAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Authorization header'dan token'ı al
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    // Token yoksa devam et (optional auth)
    if (!token) {
      next();
      return;
    }

    try {
      // Token'ı doğrula
      const decoded = jwt.verify(token, config.jwt.secret) as any;

      // UserCustomer rol kontrolü
      if (decoded.role !== 'USER_CUSTOMER') {
        // Farklı rol, devam et (optional auth)
        next();
        return;
      }

      // Kullanıcıyı veritabanından al
      const userCustomerRepository = AppDataSource.getRepository(UserCustomer);
      const userCustomer = await userCustomerRepository.findOne({
        where: { id: decoded.userId },
      });

      // Kullanıcı bulundu ve aktifse request'e ekle
      if (userCustomer && userCustomer.is_active) {
        req.userCustomer = userCustomer;
        req.userCustomerId = userCustomer.id;
      }
    } catch (tokenError) {
      // Token geçersiz veya süresi dolmuş, devam et (optional auth)
      // Hata vermiyoruz çünkü bu optional authentication
    }

    next();
  } catch (error) {
    // Beklenmeyen hatalar için de devam et (optional auth)
    console.error('Optional UserCustomer auth middleware error:', error);
    next();
  }
};


import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { UserCustomer } from '../entities/UserCustomer';
import { config } from '../config';

/**
 * JWT Payload interface for UserCustomer
 */
export interface UserCustomerJwtPayload {
  userId: string;
  email: string;
  role: string; // 'USER_CUSTOMER'
}

/**
 * UserCustomer kimlik doğrulama middleware'i
 * Bireysel kullanıcılar için JWT token kontrolü yapar
 */
export const userCustomerAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Authorization header'dan token'ı al
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      res.status(401).json({ 
        success: false,
        error: 'Kimlik doğrulama token\'ı gerekli' 
      });
      return;
    }

    // Token'ı doğrula
    const decoded = jwt.verify(token, config.jwt.secret) as UserCustomerJwtPayload;

    // UserCustomer rol kontrolü
    if (decoded.role !== 'USER_CUSTOMER') {
      res.status(403).json({ 
        success: false,
        error: 'Bu işlem için yetkili değilsiniz' 
      });
      return;
    }

    // Kullanıcıyı veritabanından al
    const userCustomerRepository = AppDataSource.getRepository(UserCustomer);
    const userCustomer = await userCustomerRepository.findOne({
      where: { id: decoded.userId },
    });

    if (!userCustomer) {
      res.status(401).json({ 
        success: false,
        error: 'Kullanıcı bulunamadı' 
      });
      return;
    }

    // Hesap aktif mi kontrol et
    if (!userCustomer.is_active) {
      res.status(403).json({ 
        success: false,
        error: 'Hesabınız aktif değil' 
      });
      return;
    }

    // Request'e kullanıcı bilgilerini ekle
    req.userCustomer = userCustomer;
    req.userCustomerId = userCustomer.id;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        success: false,
        error: 'Geçersiz token' 
      });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ 
        success: false,
        error: 'Token süresi dolmuş' 
      });
      return;
    }
    console.error('UserCustomer auth middleware error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Kimlik doğrulama hatası' 
    });
  }
};


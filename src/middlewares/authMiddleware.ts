import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { config } from '../config';
import { EntityStatus } from '../types/enums';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Authentication Middleware
 * JWT token'ı doğrular ve kullanıcıyı request'e ekler
 * Soft delete kontrolü yapar - silinmiş kullanıcılar giriş yapamaz
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Authorization header'dan token'ı al
    // Format: "Bearer TOKEN" veya sadece "TOKEN"
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ error: 'Authentication token required' });
      return;
    }

    // Bearer token formatını kontrol et
    let token: string;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      // Eğer Bearer prefix'i yoksa, direkt token olarak kabul et (geriye dönük uyumluluk)
      token = authHeader;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication token required' });
      return;
    }

    // Token'ı doğrula
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (jwtError) {
      if (jwtError instanceof jwt.JsonWebTokenError) {
        console.error('❌ JWT Error:', jwtError.message);
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      if (jwtError instanceof jwt.TokenExpiredError) {
        console.error('❌ Token expired:', jwtError.expiredAt);
        res.status(401).json({ error: 'Token expired' });
        return;
      }
      throw jwtError;
    }

    // Kullanıcıyı veritabanından getir
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: decoded.userId },
      relations: ['agency', 'branch', 'managedAgencies', 'managedAgencies.agency'],
    });

    if (!user) {
      console.error('❌ User not found:', decoded.userId);
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Soft delete kontrolü - silinmiş kullanıcılar giriş yapamaz
    if (user.is_deleted) {
      console.error('❌ User is deleted:', decoded.userId);
      res.status(403).json({ error: 'User account has been deleted' });
      return;
    }

    // Kullanıcı durumu kontrolü - sadece aktif kullanıcılar giriş yapabilir
    if (user.status !== EntityStatus.ACTIVE) {
      console.error('❌ User account is not active:', decoded.userId, 'Status:', user.status);
      res.status(403).json({ error: 'User account is not active' });
      return;
    }

    // Kullanıcıyı request'e ekle
    req.user = user;
    next();
  } catch (error) {
    // Beklenmeyen hatalar için log ve hata mesajı
    console.error('❌ Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

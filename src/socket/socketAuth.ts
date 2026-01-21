import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { config } from '../config';
import { EntityStatus } from '../types/enums';
import logger from '../utils/logger';

/**
 * Socket Authentication Middleware
 * JWT token'ı socket handshake'den alır ve kullanıcıyı doğrular
 * Kullanıcı bilgisini socket'e ekler
 * Socket'in tüm metodlarına (emit, on, disconnect, id) erişim sağlar
 * Type assertion kullanarak Socket metodlarını koruyoruz
 */
export type AuthenticatedSocket = Socket & {
  user?: User;
  userId?: string;
}

/**
 * Socket handshake'den JWT token'ı alır
 * Token query parametrelerinden veya auth object'inden alınabilir
 */
export const getTokenFromSocket = (socket: Socket): string | null => {
  // Query parametrelerinden token al (örnek: ?token=xxx)
  const tokenFromQuery = socket.handshake.query.token as string;
  if (tokenFromQuery) {
    return tokenFromQuery;
  }

  // Auth object'inden token al
  const tokenFromAuth = socket.handshake.auth?.token as string;
  if (tokenFromAuth) {
    return tokenFromAuth;
  }

  return null;
};

/**
 * Socket authentication middleware
 * JWT token'ı doğrular ve kullanıcıyı socket'e ekler
 */
export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    // Token'ı al
    const token = getTokenFromSocket(socket);

    if (!token) {
      logger.warn('Socket connection attempt without token');
      return next(new Error('Authentication token required'));
    }

    // Token'ı doğrula
    let decoded: { userId: string; email: string; role: string };
    try {
      decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        email: string;
        role: string;
      };
    } catch (jwtError) {
      if (jwtError instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid JWT token in socket connection:', jwtError.message);
        return next(new Error('Invalid token'));
      }
      if (jwtError instanceof jwt.TokenExpiredError) {
        logger.warn('Expired JWT token in socket connection');
        return next(new Error('Token expired'));
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
      logger.warn('User not found in socket connection:', decoded.userId);
      return next(new Error('User not found'));
    }

    // Soft delete kontrolü
    if (user.is_deleted) {
      logger.warn('Deleted user attempted socket connection:', decoded.userId);
      return next(new Error('User account has been deleted'));
    }

    // Kullanıcı durumu kontrolü
    if (user.status !== EntityStatus.ACTIVE) {
      logger.warn('Inactive user attempted socket connection:', decoded.userId);
      return next(new Error('User account is not active'));
    }

    // Kullanıcıyı socket'e ekle
    socket.user = user;
    socket.userId = user.id;

    logger.info(`Socket authenticated for user: ${user.email} (${user.id})`);
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

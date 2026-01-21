import { Request, Response } from 'express';
import { ActiveUsersService } from '../services/ActiveUsersService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

/**
 * Active Users Controller
 * REST API endpoint'leri için aktif kullanıcı yönetimi
 * Socket.io ile gerçek zamanlı takip yapılır, bu endpoint fallback olarak kullanılabilir
 */
export class ActiveUsersController {
  private activeUsersService: ActiveUsersService;

  constructor() {
    this.activeUsersService = new ActiveUsersService();
  }

  /**
   * Aktif kullanıcıları getir
   * SUPER_ADMIN: Tüm aktif kullanıcılar
   * SUPER_AGENCY_ADMIN: Yönettiği broker'lardaki aktif kullanıcılar
   */
  getActiveUsers = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const activeUsers = await this.activeUsersService.getActiveUsers(req.user);
      successResponse(res, activeUsers, 'Active users retrieved successfully');
    }
  );

  /**
   * Aktif kullanıcı sayısını getir
   */
  getActiveUsersCount = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const count = await this.activeUsersService.getActiveUsersCount(req.user);
      successResponse(res, { count }, 'Active users count retrieved successfully');
    }
  );

  /**
   * Belirli bir kullanıcının aktif olup olmadığını kontrol et
   */
  checkUserActive = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const isActive = await this.activeUsersService.isUserActive(userId);
      successResponse(res, { isActive }, 'User active status retrieved successfully');
    }
  );
}

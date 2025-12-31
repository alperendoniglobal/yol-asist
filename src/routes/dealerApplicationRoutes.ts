import { Router } from 'express';
import { DealerApplicationController } from '../controllers/DealerApplicationController';
import { authMiddleware, superAdminOnly } from '../middlewares';

const router = Router();
const controller = new DealerApplicationController();

/**
 * Bayilik Başvuru Routes
 * Tüm endpoint'ler Super Admin yetkisi gerektirir
 */

// Super Admin authentication
router.use(authMiddleware);
router.use(superAdminOnly);

// Bekleyen başvuru sayısı
router.get('/pending-count', controller.getPendingCount);

// Tüm başvuruları getir
router.get('/', controller.getAll);

// Tek bir başvuruyu getir
router.get('/:id', controller.getById);

// Başvuruyu onayla
router.put('/:id/approve', controller.approve);

// Başvuruyu reddet
router.put('/:id/reject', controller.reject);

export default router;


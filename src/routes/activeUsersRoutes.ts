import { Router } from 'express';
import { ActiveUsersController } from '../controllers/ActiveUsersController';
import { authMiddleware } from '../middlewares';
import { superAdminOrSuperAgencyAdmin } from '../middlewares/roleMiddleware';

const router = Router();
const activeUsersController = new ActiveUsersController();

// Tüm route'lar authentication gerektirir
router.use(authMiddleware);

// Sadece SUPER_ADMIN ve SUPER_AGENCY_ADMIN aktif kullanıcıları görebilir
router.get(
  '/',
  superAdminOrSuperAgencyAdmin,
  activeUsersController.getActiveUsers
);

router.get(
  '/count',
  superAdminOrSuperAgencyAdmin,
  activeUsersController.getActiveUsersCount
);

router.get(
  '/:userId/check',
  superAdminOrSuperAgencyAdmin,
  activeUsersController.checkUserActive
);

export default router;

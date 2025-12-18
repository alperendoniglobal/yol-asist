import { Router } from 'express';
import { CommissionController } from '../controllers/CommissionController';
import { authMiddleware, tenantMiddleware, agencyAdminOrAbove, superAdminOnly } from '../middlewares';

const router = Router();
const commissionController = new CommissionController();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);

// CRUD operations
router.get('/', commissionController.getAll);
router.get('/:id', commissionController.getById);
router.post('/', agencyAdminOrAbove, commissionController.create);

// Super admin operations
router.post('/:id/approve', superAdminOnly, commissionController.approve);
router.post('/:id/reject', superAdminOnly, commissionController.reject);
router.post('/:id/mark-paid', superAdminOnly, commissionController.markAsPaid);

export default router;

import { Router } from 'express';
import { AgencyController } from '../controllers/AgencyController';
import { authMiddleware, tenantMiddleware, superAdminOnly } from '../middlewares';

const router = Router();
const agencyController = new AgencyController();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);

// CRUD operations
router.get('/', agencyController.getAll);
router.get('/:id', agencyController.getById);
router.post('/', superAdminOnly, agencyController.create);
router.put('/:id', superAdminOnly, agencyController.update);
router.delete('/:id', superAdminOnly, agencyController.delete);

// Statistics
router.get('/:id/stats', agencyController.getStats);

export default router;

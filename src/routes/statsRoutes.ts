import { Router } from 'express';
import { StatsController } from '../controllers/StatsController';
import { authMiddleware, tenantMiddleware } from '../middlewares';

const router = Router();
const statsController = new StatsController();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);

// Statistics endpoints
router.get('/dashboard', statsController.getDashboard);
router.get('/sales', statsController.getSalesStats);
router.get('/revenue', statsController.getRevenueStats);
router.get('/customers', statsController.getCustomerStats);
router.get('/agencies', statsController.getAgencyStats);

export default router;

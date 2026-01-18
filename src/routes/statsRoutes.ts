import { Router } from 'express';
import { StatsController } from '../controllers/StatsController';
import { authMiddleware, tenantMiddleware } from '../middlewares';
import { superAdminOrSuperAgencyAdmin, superAdminOnly } from '../middlewares/roleMiddleware';

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

// SUPER_AGENCY_ADMIN performans raporu (SUPER_ADMIN ve SUPER_AGENCY_ADMIN erişebilir)
router.get(
  '/super-agency-admin/performance',
  superAdminOrSuperAgencyAdmin,
  statsController.getSuperAgencyAdminPerformanceReport
);

// Seçilen broker için satış trendi (SUPER_ADMIN ve SUPER_AGENCY_ADMIN erişebilir)
router.get(
  '/agency/:agencyId/sales',
  superAdminOrSuperAgencyAdmin,
  statsController.getAgencySalesData
);

// Satış Dağılım Raporu - SADECE SUPER_ADMIN erişebilir
router.get(
  '/sales-distribution',
  superAdminOnly,
  statsController.getSalesDistributionReport
);

export default router;

import { Router } from 'express';
import { AgencyController } from '../controllers/AgencyController';
import { authMiddleware, tenantMiddleware, superAdminOnly, superAdminOrSuperAgencyAdmin } from '../middlewares';

const router = Router();
const agencyController = new AgencyController();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);

// CRUD operations
router.get('/', agencyController.getAll);
router.get('/:id', agencyController.getById);
// SUPER_AGENCY_ADMIN da broker oluşturabilir, kendi brokerlarını düzenleyebilir ve silebilir
router.post('/', superAdminOrSuperAgencyAdmin, agencyController.create);
router.put('/:id', superAdminOrSuperAgencyAdmin, agencyController.update);
router.delete('/:id', superAdminOrSuperAgencyAdmin, agencyController.delete);

// Statistics
router.get('/:id/stats', agencyController.getStats);

// Komisyon dağılım raporu (Acente Admin için)
router.get('/:id/commission-distribution', agencyController.getBranchCommissionDistribution);

export default router;

import { Router } from 'express';
import { BranchController } from '../controllers/BranchController';
import { authMiddleware, tenantMiddleware, agencyAdminOrAbove } from '../middlewares';

const router = Router();
const branchController = new BranchController();

// Tum route'lar authentication gerektiriyor
router.use(authMiddleware);
router.use(tenantMiddleware);

// Sube listeleme (?includeCommission=true ile komisyon bilgisi de gelir)
router.get('/', branchController.getAll);

// Sube detaylari (basit)
router.get('/:id', branchController.getById);

// Sube detaylari ile performans istatistikleri
router.get('/:id/stats', agencyAdminOrAbove, branchController.getByIdWithStats);

// Şubenin komisyon oranını getir
router.get('/:id/commission', agencyAdminOrAbove, branchController.getCommissionRate);

// CRUD islemleri (sadece admin'ler icin)
router.post('/', agencyAdminOrAbove, branchController.create);
router.put('/:id', agencyAdminOrAbove, branchController.update);
router.delete('/:id', agencyAdminOrAbove, branchController.delete);

// Şube komisyon oranı güncelleme (sadece acente yöneticisi ve üstü)
// Ana merkez şubelerin komisyon oranlarını bu endpoint ile belirler
router.patch('/:id/commission', agencyAdminOrAbove, branchController.updateCommissionRate);

export default router;

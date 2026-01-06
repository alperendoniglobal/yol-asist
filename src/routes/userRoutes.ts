import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authMiddleware, tenantMiddleware, branchAdminOrAbove, superAdminOnly } from '../middlewares';

const router = Router();
const userController = new UserController();

// Tum route'lar authentication gerektiriyor
router.use(authMiddleware);
router.use(tenantMiddleware);

// Kullanici listeleme ve detay
router.get('/', userController.getAll);
router.get('/:id', userController.getById);

// Kullanici aktiviteleri ile birlikte detay getir
// Acente yoneticisi calisanlarinin islemlerini gormek icin
router.get('/:id/activity', branchAdminOrAbove, userController.getByIdWithActivity);

// CRUD islemleri (sadece admin'ler icin)
router.post('/', branchAdminOrAbove, userController.create);
router.put('/:id', branchAdminOrAbove, userController.update);
router.delete('/:id', branchAdminOrAbove, userController.delete);

// Kullanici durumunu degistir (aktif/pasif toggle)
// Acente yoneticisi calisanlarini aktif/pasif yapabilir
router.patch('/:id/toggle-status', branchAdminOrAbove, userController.toggleStatus);

// Izinleri guncelle
router.put('/:id/permissions', branchAdminOrAbove, userController.updatePermissions);

// Broker yönetimi (Sadece SUPER_ADMIN için)
// AGENCY_ADMIN kullanıcısına broker atama
router.post('/:id/agencies/:agencyId', superAdminOnly, userController.assignAgency);

// AGENCY_ADMIN kullanıcısından broker kaldırma
router.delete('/:id/agencies/:agencyId', superAdminOnly, userController.removeAgency);

// Kullanıcının yönettiği brokerları getir
router.get('/:id/agencies', branchAdminOrAbove, userController.getManagedAgencies);

export default router;

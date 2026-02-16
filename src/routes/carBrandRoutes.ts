import { Router } from 'express';
import { CarBrandController } from '../controllers/CarBrandController';
import { authMiddleware, superAdminOnly } from '../middlewares';

const router = Router();
const brandController = new CarBrandController();

// Tüm route'lar authentication gerektirir
router.use(authMiddleware);

// Listeleme ve tek kayıt (tüm yetkili kullanıcılar)
router.get('/', brandController.getAll);
router.get('/:id', brandController.getById);

// Oluştur / Güncelle / Sil — sadece SUPER_ADMIN
router.post('/', superAdminOnly, brandController.create);
router.put('/:id', superAdminOnly, brandController.update);
router.delete('/:id', superAdminOnly, brandController.delete);

export default router;


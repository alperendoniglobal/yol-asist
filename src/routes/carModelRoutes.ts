import { Router } from 'express';
import { CarModelController } from '../controllers/CarModelController';
import { authMiddleware, superAdminOnly } from '../middlewares';

const router = Router();
const modelController = new CarModelController();

// Tüm route'lar authentication gerektirir
router.use(authMiddleware);

// Listeleme ve tek kayıt (daha spesifik route'lar önce)
router.get('/brand/:brandId', modelController.getByBrand);
router.get('/', modelController.getAll);
router.get('/:id', modelController.getById);

// Oluştur / Güncelle / Sil — sadece SUPER_ADMIN
router.post('/', superAdminOnly, modelController.create);
router.put('/:id', superAdminOnly, modelController.update);
router.delete('/:id', superAdminOnly, modelController.delete);

export default router;


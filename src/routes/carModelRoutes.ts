import { Router } from 'express';
import { CarModelController } from '../controllers/CarModelController';
import { authMiddleware } from '../middlewares';

const router = Router();
const modelController = new CarModelController();

// All routes require authentication
router.use(authMiddleware);

// Public endpoints (no tenant filter needed for models)
router.get('/', modelController.getAll);
router.get('/:id', modelController.getById);
router.get('/brand/:brandId', modelController.getByBrand);

export default router;


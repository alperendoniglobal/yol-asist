import { Router } from 'express';
import { CarBrandController } from '../controllers/CarBrandController';
import { authMiddleware } from '../middlewares';

const router = Router();
const brandController = new CarBrandController();

// All routes require authentication
router.use(authMiddleware);

// Public endpoints (no tenant filter needed for brands)
router.get('/', brandController.getAll);
router.get('/:id', brandController.getById);

export default router;


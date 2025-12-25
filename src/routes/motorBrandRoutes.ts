import { Router } from 'express';
import { MotorBrandController } from '../controllers/MotorBrandController';
import { authMiddleware } from '../middlewares';

const router = Router();
const brandController = new MotorBrandController();

// All routes require authentication
router.use(authMiddleware);

// Public endpoints (no tenant filter needed for brands)
router.get('/', brandController.getAll);
router.get('/:id', brandController.getById);

export default router;


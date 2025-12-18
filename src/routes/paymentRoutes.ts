import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { authMiddleware, tenantMiddleware, allRoles } from '../middlewares';

const router = Router();
const paymentController = new PaymentController();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);

// CRUD operations
router.get('/', paymentController.getAll);
router.get('/:id', paymentController.getById);
router.post('/', allRoles, paymentController.create);

// Payment processing
router.post('/iyzico', allRoles, paymentController.processIyzico);
router.post('/balance', allRoles, paymentController.processBalance);

// Refund
router.post('/:id/refund', paymentController.refund);

export default router;

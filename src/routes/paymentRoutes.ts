import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { authMiddleware, tenantMiddleware, allRoles } from '../middlewares';

const router = Router();
const paymentController = new PaymentController();

// PayTR callback endpoint (public - auth gerektirmez, PayTR'dan gelecek)
// Hem POST hem GET kabul eder (GET test için, POST PayTR'dan gelecek)
router.post('/paytr/callback', paymentController.handlePaytrCallback);
router.get('/paytr/callback', paymentController.handlePaytrCallback);

// All other routes require authentication
// ÖNEMLİ: Callback route'ları yukarıda tanımlanmalı, auth middleware'lerden önce
router.use(authMiddleware);
router.use(tenantMiddleware);

// CRUD operations
router.get('/', paymentController.getAll);
router.get('/:id', paymentController.getById);
router.post('/', allRoles, paymentController.create);

// Payment processing
router.post('/paytr/token', allRoles, paymentController.getPaytrToken);
router.post('/balance', allRoles, paymentController.processBalance);

// Refund
router.post('/:id/refund', paymentController.refund);

export default router;

import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authMiddleware } from '../middlewares';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);

// Protected routes
router.use(authMiddleware);
router.post('/logout', authController.logout);
router.get('/me', authController.me);
router.post('/change-password', authController.changePassword);

export default router;

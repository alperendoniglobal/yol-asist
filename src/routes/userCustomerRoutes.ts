import { Router } from 'express';
import { UserCustomerController } from '../controllers/UserCustomerController';
import { userCustomerAuthMiddleware } from '../middlewares/userCustomerAuthMiddleware';

const router = Router();
const userCustomerController = new UserCustomerController();

/**
 * UserCustomer Routes
 * Bireysel kullanıcılar için API endpoint'leri
 * 
 * Public routes (kimlik doğrulama gerektirmeyen):
 * - POST /register - Kayıt ol
 * - POST /login - Giriş yap
 * - POST /refresh-token - Token yenile
 * 
 * Protected routes (kimlik doğrulama gerektiren):
 * - GET /profile - Profil bilgilerini getir
 * - PUT /profile - Profil güncelle
 * - PUT /change-password - Şifre değiştir
 * - GET /purchases - Satın alınan paketleri getir
 * - GET /vehicles - Araçları getir
 * - POST /purchase - Paket satın al
 */

// ===== PUBLIC ROUTES =====

// Kayıt ol
router.post('/register', userCustomerController.register);

// Giriş yap
router.post('/login', userCustomerController.login);

// Token yenile
router.post('/refresh-token', userCustomerController.refreshToken);

// ===== PROTECTED ROUTES =====

// Profil bilgilerini getir
router.get('/profile', userCustomerAuthMiddleware, userCustomerController.getProfile);

// Profil güncelle
router.put('/profile', userCustomerAuthMiddleware, userCustomerController.updateProfile);

// Şifre değiştir
router.put('/change-password', userCustomerAuthMiddleware, userCustomerController.changePassword);

// Satın alınan paketleri getir
router.get('/purchases', userCustomerAuthMiddleware, userCustomerController.getMyPurchases);

// Araçları getir
router.get('/vehicles', userCustomerAuthMiddleware, userCustomerController.getMyVehicles);

// Paket satın al
router.post('/purchase', userCustomerAuthMiddleware, userCustomerController.purchase);

export default router;


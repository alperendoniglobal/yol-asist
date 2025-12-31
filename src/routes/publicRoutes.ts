import { Router } from 'express';
import { PublicController } from '../controllers/PublicController';
import { DealerApplicationController } from '../controllers/DealerApplicationController';

const router = Router();
const publicController = new PublicController();
const dealerApplicationController = new DealerApplicationController();

/**
 * Public API Routes
 * Bu route'lar authentication gerektirmez
 * Paketler, hizmetler ve satın alma işlemleri için kullanılır
 */

// ===== PAKET ROUTES =====
// Tüm aktif paketleri fiyatsız olarak getir
router.get('/packages', publicController.getPackages);

// Tek bir paketi fiyatsız olarak getir
router.get('/packages/:id', publicController.getPackageById);

// ===== HİZMET ROUTES =====
// Tüm unique hizmet başlıklarını getir (footer için)
router.get('/services', publicController.getServices);

// ===== ARAÇ MARKA/MODEL ROUTES =====
// Araba markaları
router.get('/car-brands', publicController.getCarBrands);
router.get('/car-models/:brandId', publicController.getCarModels);

// Motor markaları
router.get('/motor-brands', publicController.getMotorBrands);
router.get('/motor-models/:brandId', publicController.getMotorModels);

// ===== TC KONTROL ROUTES =====
// TC Kimlik No kontrolü - sistemde var mı?
router.get('/check-tc/:tc', publicController.checkTc);

// ===== SATIN ALMA ROUTES =====
// Kullanıcı satın alma işlemi (iyzico ödeme)
router.post('/purchase', publicController.processPurchase);

// ===== BAYİLİK BAŞVURU ROUTES =====
// Yeni bayilik başvurusu oluştur
router.post('/dealer-application', dealerApplicationController.create);

export default router;


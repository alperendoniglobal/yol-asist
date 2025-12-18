import { Router } from 'express';
import { PackageController } from '../controllers/PackageController';
import { authMiddleware, superAdminOnly, allRoles } from '../middlewares';

const router = Router();
const packageController = new PackageController();

// Tüm route'lar authentication gerektirir
router.use(authMiddleware);

// ===== OKUMA İŞLEMLERİ (Tüm authenticated kullanıcılar) =====

// Tüm paketleri listele (filtreleme destekli)
// GET /packages?vehicle_type=Otomobil&status=ACTIVE
router.get('/', allRoles, packageController.getAll);

// Uygun paketleri getir (satış sırasında kullanılır)
// GET /packages/available?vehicleType=Otomobil&vehicleAge=5
router.get('/available', allRoles, packageController.getAvailablePackages);

// Araç türüne göre paketleri getir
// GET /packages/vehicle-type/Otomobil
router.get('/vehicle-type/:vehicleType', allRoles, packageController.getByVehicleType);

// Tek paket detayı
// GET /packages/:id
router.get('/:id', allRoles, packageController.getById);

// Paket kapsamlarını listele
// GET /packages/:id/covers
router.get('/:id/covers', allRoles, packageController.getCovers);

// ===== YAZMA İŞLEMLERİ (Sadece SUPER_ADMIN) =====

// Yeni paket oluştur
// POST /packages
router.post('/', superAdminOnly, packageController.create);

// Paket güncelle
// PUT /packages/:id
router.put('/:id', superAdminOnly, packageController.update);

// Paket sil
// DELETE /packages/:id
router.delete('/:id', superAdminOnly, packageController.delete);

// Kapsam ekle
// POST /packages/:id/covers
router.post('/:id/covers', superAdminOnly, packageController.addCover);

// Kapsam güncelle
// PUT /packages/:id/covers/:coverId
router.put('/:id/covers/:coverId', superAdminOnly, packageController.updateCover);

// Kapsam sil
// DELETE /packages/:id/covers/:coverId
router.delete('/:id/covers/:coverId', superAdminOnly, packageController.deleteCover);

export default router;

import { Router } from 'express';
import { SaleController } from '../controllers/SaleController';
import { authMiddleware, tenantMiddleware, allRoles, agencyAdminOrAbove } from '../middlewares';

const router = Router();
const saleController = new SaleController();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);

// CRUD operations
router.get('/', saleController.getAll);
router.get('/stats', saleController.getStats);
router.get('/export', allRoles, saleController.export);
router.get('/:id', saleController.getById);
router.post('/', allRoles, saleController.create);
router.put('/:id', allRoles, saleController.update);
router.delete('/:id', allRoles, saleController.delete);

// Komple satış işlemi - Transaction ile tüm adımları tek seferde yapar
// Müşteri + Araç + Satış + Ödeme hepsi birlikte işlenir
// Herhangi birinde hata olursa hiçbir kayıt oluşturulmaz
router.post('/complete', allRoles, saleController.completeSale);

// ===== İADE İŞLEMLERİ =====
// İade tutarını hesapla - tüm roller görebilir
// GET /api/sales/:id/refund - İade tutarını hesaplar (KDV hariç kalan günlerin ücreti)
router.get('/:id/refund', allRoles, saleController.calculateRefund);

// İade işlemini gerçekleştir - sadece agency admin ve üstü yapabilir
// POST /api/sales/:id/refund - İade işlemini onaylar ve kaydeder
router.post('/:id/refund', agencyAdminOrAbove, saleController.processRefund);

export default router;

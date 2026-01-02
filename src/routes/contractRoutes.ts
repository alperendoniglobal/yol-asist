import { Router } from 'express';
import { ContractController } from '../controllers/ContractController';
import { authMiddleware, superAdminOnly } from '../middlewares';

/**
 * Sözleşme Route'ları
 * Sözleşme versiyonları ve onay işlemleri için API endpoint'leri
 */

const router = Router();
const contractController = new ContractController();

// ==========================================
// PUBLIC ENDPOINT'LER (Auth gerektirmez)
// ==========================================

/**
 * Aktif sözleşme versiyonunu getirir
 * GET /api/v1/contract/current
 */
router.get('/current', contractController.getCurrentVersion);

/**
 * Sözleşmeyi PDF formatında getirir
 * GET /api/v1/contract/pdf
 * GET /api/v1/contract/pdf/:versionId
 */
router.get('/pdf', contractController.getPdf);
router.get('/pdf/:versionId', contractController.getPdf);

// ==========================================
// ACENTE KULLANICI ENDPOINT'LERİ
// ==========================================

/**
 * Acente için sözleşme durumunu kontrol eder
 * GET /api/v1/contract/status
 */
router.get(
  '/status',
  authMiddleware,
  contractController.checkStatus
);

/**
 * Sözleşmeyi onaylar
 * POST /api/v1/contract/accept
 * Body: { checkbox1_accepted, checkbox2_accepted, scroll_completed }
 */
router.post(
  '/accept',
  authMiddleware,
  contractController.acceptContract
);

/**
 * Acente onay geçmişini getirir
 * GET /api/v1/contract/history
 * GET /api/v1/contract/history/:agencyId (Super Admin için)
 */
router.get(
  '/history',
  authMiddleware,
  contractController.getHistory
);

router.get(
  '/history/:agencyId',
  authMiddleware,
  superAdminOnly,
  contractController.getHistory
);

// ==========================================
// SUPER ADMIN ENDPOINT'LERİ
// ==========================================

/**
 * Tüm sözleşme versiyonlarını getirir
 * GET /api/v1/contract/versions
 */
router.get(
  '/versions',
  authMiddleware,
  superAdminOnly,
  contractController.getAllVersions
);

/**
 * Yeni sözleşme versiyonu oluşturur
 * POST /api/v1/contract/versions
 * Body: { version, title, content, summary?, change_notes?, is_active? }
 */
router.post(
  '/versions',
  authMiddleware,
  superAdminOnly,
  contractController.createVersion
);

/**
 * Sözleşme versiyonunu günceller
 * PUT /api/v1/contract/versions/:id
 * Body: { version?, title?, content?, summary?, change_notes?, is_active? }
 */
router.put(
  '/versions/:id',
  authMiddleware,
  superAdminOnly,
  contractController.updateVersion
);

/**
 * Bir versiyonu aktif yapar
 * POST /api/v1/contract/versions/:id/activate
 * Not: Bu işlem tüm acentelerin yeniden onay vermesini gerektirir
 */
router.post(
  '/versions/:id/activate',
  authMiddleware,
  superAdminOnly,
  contractController.activateVersion
);

/**
 * Onay raporunu getirir
 * GET /api/v1/contract/report
 * Query: { start_date?, end_date?, version? }
 */
router.get(
  '/report',
  authMiddleware,
  superAdminOnly,
  contractController.getReport
);

export default router;

import { Router } from 'express';
import { PdfController } from '../controllers/PdfController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const pdfController = new PdfController();

// Tum PDF route'lari authentication gerektirir
router.use(authMiddleware);

// Satis PDF - indir
router.get('/sale/:id', pdfController.generateSaleContract);

// Satis PDF - goruntle
router.get('/sale/:id/view', pdfController.viewSaleContract);

export default router;


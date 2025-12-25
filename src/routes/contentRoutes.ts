import { Router, Request, Response } from 'express';
import { ContentController } from '../controllers/ContentController';
import { authMiddleware, superAdminOnly } from '../middlewares';
import { uploadBanner } from '../middlewares/uploadMiddleware';
import { successResponse } from '../utils/response';

const router = Router();
const contentController = new ContentController();

// Public routes (landing page için)
router.get('/landing-page', contentController.getLandingPageContent);
router.get('/banners/active', contentController.getActiveBanners);
router.get('/features/active', contentController.getActiveFeatures);
router.get('/stats/active', contentController.getActiveStats);
router.get('/pages/:slug', contentController.getPageBySlug);
router.get('/pages', contentController.getAllPages); // Landing page için public

// Protected routes (SUPER_ADMIN only)
router.use(authMiddleware);
router.use(superAdminOnly);

// Landing Page Content
router.get('/landing-page/admin', contentController.getLandingPageContent);
router.put('/landing-page', contentController.updateLandingPageContent);

// Banners
router.get('/banners', contentController.getAllBanners);
router.get('/banners/:id', contentController.getBannerById);
router.post('/banners', contentController.createBanner);
router.put('/banners/:id', contentController.updateBanner);
router.delete('/banners/:id', contentController.deleteBanner);
router.post('/banners/order', contentController.updateBannerOrder);

// Banner image upload
router.post('/upload/banner', uploadBanner.single('image'), (req: Request, res: Response) => {
  if (!((req as any).file)) {
    return ((res as any).status(400).json({ error: 'No file uploaded' }) as any);
  }
  // Dosya yolu: /uploads/banners/filename
    const filePath = `/uploads/banners/${(req as any).file.filename}`;
    successResponse(res as Response, { path: filePath }, 'Banner image uploaded successfully');
});

// Features
router.get('/features', contentController.getAllFeatures);
router.get('/features/:id', contentController.getFeatureById);
router.post('/features', contentController.createFeature);
router.put('/features/:id', contentController.updateFeature);
router.delete('/features/:id', contentController.deleteFeature);
router.post('/features/order', contentController.updateFeatureOrder);

// Stats
router.get('/stats', contentController.getAllStats);
router.get('/stats/:id', contentController.getStatById);
router.post('/stats', contentController.createStat);
router.put('/stats/:id', contentController.updateStat);
router.delete('/stats/:id', contentController.deleteStat);
router.post('/stats/order', contentController.updateStatOrder);

// Page Contents (admin için)
router.get('/pages/admin/:id', contentController.getPageById);
router.post('/pages', contentController.createPage);
router.put('/pages/:id', contentController.updatePage);
router.delete('/pages/:id', contentController.deletePage);

export default router;


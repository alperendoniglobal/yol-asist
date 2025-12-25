import { Request, Response } from 'express';
import { ContentService } from '../services/ContentService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class ContentController {
  private contentService: ContentService;

  constructor() {
    this.contentService = new ContentService();
  }

  // ===== LANDING PAGE CONTENT =====

  getLandingPageContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const content = await this.contentService.getLandingPageContent();
    successResponse(res, content, 'Landing page content retrieved successfully');
  });

  updateLandingPageContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const content = await this.contentService.updateLandingPageContent(req.body);
    successResponse(res, content, 'Landing page content updated successfully');
  });

  // ===== BANNERS =====

  getAllBanners = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const banners = await this.contentService.getAllBanners();
    successResponse(res, banners, 'Banners retrieved successfully');
  });

  getActiveBanners = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const banners = await this.contentService.getActiveBanners();
    successResponse(res, banners, 'Active banners retrieved successfully');
  });

  getBannerById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const banner = await this.contentService.getBannerById(id);
    successResponse(res, banner, 'Banner retrieved successfully');
  });

  createBanner = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const banner = await this.contentService.createBanner(req.body);
    successResponse(res, banner, 'Banner created successfully', 201);
  });

  updateBanner = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const banner = await this.contentService.updateBanner(id, req.body);
    successResponse(res, banner, 'Banner updated successfully');
  });

  deleteBanner = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.contentService.deleteBanner(id);
    successResponse(res, result, 'Banner deleted successfully');
  });

  updateBannerOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { bannerIds } = req.body;
    const banners = await this.contentService.updateBannerOrder(bannerIds);
    successResponse(res, banners, 'Banner order updated successfully');
  });

  // ===== FEATURES =====

  getAllFeatures = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const features = await this.contentService.getAllFeatures();
    successResponse(res, features, 'Features retrieved successfully');
  });

  getActiveFeatures = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const features = await this.contentService.getActiveFeatures();
    successResponse(res, features, 'Active features retrieved successfully');
  });

  getFeatureById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const feature = await this.contentService.getFeatureById(id);
    successResponse(res, feature, 'Feature retrieved successfully');
  });

  createFeature = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const feature = await this.contentService.createFeature(req.body);
    successResponse(res, feature, 'Feature created successfully', 201);
  });

  updateFeature = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const feature = await this.contentService.updateFeature(id, req.body);
    successResponse(res, feature, 'Feature updated successfully');
  });

  deleteFeature = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.contentService.deleteFeature(id);
    successResponse(res, result, 'Feature deleted successfully');
  });

  updateFeatureOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { featureIds } = req.body;
    const features = await this.contentService.updateFeatureOrder(featureIds);
    successResponse(res, features, 'Feature order updated successfully');
  });

  // ===== STATS =====

  getAllStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.contentService.getAllStats();
    successResponse(res, stats, 'Stats retrieved successfully');
  });

  getActiveStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.contentService.getActiveStats();
    successResponse(res, stats, 'Active stats retrieved successfully');
  });

  getStatById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const stat = await this.contentService.getStatById(id);
    successResponse(res, stat, 'Stat retrieved successfully');
  });

  createStat = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stat = await this.contentService.createStat(req.body);
    successResponse(res, stat, 'Stat created successfully', 201);
  });

  updateStat = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const stat = await this.contentService.updateStat(id, req.body);
    successResponse(res, stat, 'Stat updated successfully');
  });

  deleteStat = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.contentService.deleteStat(id);
    successResponse(res, result, 'Stat deleted successfully');
  });

  updateStatOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { statIds } = req.body;
    const stats = await this.contentService.updateStatOrder(statIds);
    successResponse(res, stats, 'Stat order updated successfully');
  });

  // ===== PAGE CONTENTS =====

  getAllPages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const pages = await this.contentService.getAllPages();
    successResponse(res, pages, 'Pages retrieved successfully');
  });

  getPageBySlug = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params;
    const page = await this.contentService.getPageBySlug(slug);
    successResponse(res, page, 'Page retrieved successfully');
  });

  getPageById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const page = await this.contentService.getPageById(id);
    successResponse(res, page, 'Page retrieved successfully');
  });

  createPage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = await this.contentService.createPage(req.body);
    successResponse(res, page, 'Page created successfully', 201);
  });

  updatePage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const page = await this.contentService.updatePage(id, req.body);
    successResponse(res, page, 'Page updated successfully');
  });

  deletePage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.contentService.deletePage(id);
    successResponse(res, result, 'Page deleted successfully');
  });
}


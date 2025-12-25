import { AppDataSource } from '../config/database';
import { LandingPageContent } from '../entities/LandingPageContent';
import { LandingPageBanner } from '../entities/LandingPageBanner';
import { LandingPageFeature } from '../entities/LandingPageFeature';
import { LandingPageStat } from '../entities/LandingPageStat';
import { PageContent } from '../entities/PageContent';
import { AppError } from '../middlewares/errorHandler';

/**
 * Content Service
 * Landing page ve sayfa içeriklerini yönetir
 * Sadece SUPER_ADMIN tarafından kullanılır
 */
export class ContentService {
  private contentRepo = AppDataSource.getRepository(LandingPageContent);
  private bannerRepo = AppDataSource.getRepository(LandingPageBanner);
  private featureRepo = AppDataSource.getRepository(LandingPageFeature);
  private statRepo = AppDataSource.getRepository(LandingPageStat);
  private pageContentRepo = AppDataSource.getRepository(PageContent);

  // ===== LANDING PAGE CONTENT (Genel Ayarlar) =====
  
  async getLandingPageContent() {
    let content = await this.contentRepo.findOne({ where: {} });
    
    // Eğer yoksa varsayılan oluştur
    if (!content) {
      content = this.contentRepo.create({
        support_phone: '+90 (850) 304 54 40',
        support_email: 'destek@cozum.net',
        company_name: 'Çözüm Asistan',
        company_address: 'Türkiye',
      });
      await this.contentRepo.save(content);
    }
    
    return content;
  }

  async updateLandingPageContent(data: Partial<LandingPageContent>) {
    let content = await this.contentRepo.findOne({ where: {} });
    
    if (!content) {
      content = this.contentRepo.create(data);
    } else {
      Object.assign(content, data);
    }
    
    await this.contentRepo.save(content);
    return content;
  }

  // ===== BANNERS =====

  async getAllBanners() {
    return await this.bannerRepo.find({
      order: { order: 'ASC' },
    });
  }

  async getActiveBanners() {
    return await this.bannerRepo.find({
      where: { is_active: true },
      order: { order: 'ASC' },
    });
  }

  async getBannerById(id: string) {
    const banner = await this.bannerRepo.findOne({ where: { id } });
    if (!banner) {
      throw new AppError(404, 'Banner not found');
    }
    return banner;
  }

  async createBanner(data: Partial<LandingPageBanner>) {
    const banner = this.bannerRepo.create(data);
    await this.bannerRepo.save(banner);
    return banner;
  }

  async updateBanner(id: string, data: Partial<LandingPageBanner>) {
    const banner = await this.getBannerById(id);
    Object.assign(banner, data);
    await this.bannerRepo.save(banner);
    return banner;
  }

  async deleteBanner(id: string) {
    const banner = await this.getBannerById(id);
    await this.bannerRepo.remove(banner);
    return { message: 'Banner deleted successfully' };
  }

  async updateBannerOrder(bannerIds: string[]) {
    // Sıralamayı güncelle
    for (let i = 0; i < bannerIds.length; i++) {
      await this.bannerRepo.update({ id: bannerIds[i] }, { order: i });
    }
    return await this.getAllBanners();
  }

  // ===== FEATURES =====

  async getAllFeatures() {
    return await this.featureRepo.find({
      order: { order: 'ASC' },
    });
  }

  async getActiveFeatures() {
    return await this.featureRepo.find({
      where: { is_active: true },
      order: { order: 'ASC' },
    });
  }

  async getFeatureById(id: string) {
    const feature = await this.featureRepo.findOne({ where: { id } });
    if (!feature) {
      throw new AppError(404, 'Feature not found');
    }
    return feature;
  }

  async createFeature(data: Partial<LandingPageFeature>) {
    const feature = this.featureRepo.create(data);
    await this.featureRepo.save(feature);
    return feature;
  }

  async updateFeature(id: string, data: Partial<LandingPageFeature>) {
    const feature = await this.getFeatureById(id);
    Object.assign(feature, data);
    await this.featureRepo.save(feature);
    return feature;
  }

  async deleteFeature(id: string) {
    const feature = await this.getFeatureById(id);
    await this.featureRepo.remove(feature);
    return { message: 'Feature deleted successfully' };
  }

  async updateFeatureOrder(featureIds: string[]) {
    for (let i = 0; i < featureIds.length; i++) {
      await this.featureRepo.update({ id: featureIds[i] }, { order: i });
    }
    return await this.getAllFeatures();
  }

  // ===== STATS =====

  async getAllStats() {
    return await this.statRepo.find({
      order: { order: 'ASC' },
    });
  }

  async getActiveStats() {
    return await this.statRepo.find({
      where: { is_active: true },
      order: { order: 'ASC' },
    });
  }

  async getStatById(id: string) {
    const stat = await this.statRepo.findOne({ where: { id } });
    if (!stat) {
      throw new AppError(404, 'Stat not found');
    }
    return stat;
  }

  async createStat(data: Partial<LandingPageStat>) {
    const stat = this.statRepo.create(data);
    await this.statRepo.save(stat);
    return stat;
  }

  async updateStat(id: string, data: Partial<LandingPageStat>) {
    const stat = await this.getStatById(id);
    Object.assign(stat, data);
    await this.statRepo.save(stat);
    return stat;
  }

  async deleteStat(id: string) {
    const stat = await this.getStatById(id);
    await this.statRepo.remove(stat);
    return { message: 'Stat deleted successfully' };
  }

  async updateStatOrder(statIds: string[]) {
    for (let i = 0; i < statIds.length; i++) {
      await this.statRepo.update({ id: statIds[i] }, { order: i });
    }
    return await this.getAllStats();
  }

  // ===== PAGE CONTENTS =====

  async getAllPages() {
    return await this.pageContentRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  async getPageBySlug(slug: string) {
    const page = await this.pageContentRepo.findOne({
      where: { slug, is_active: true },
    });
    if (!page) {
      throw new AppError(404, 'Page not found');
    }
    return page;
  }

  async getPageById(id: string) {
    const page = await this.pageContentRepo.findOne({ where: { id } });
    if (!page) {
      throw new AppError(404, 'Page not found');
    }
    return page;
  }

  async createPage(data: Partial<PageContent>) {
    // Slug kontrolü
    const existing = await this.pageContentRepo.findOne({
      where: { slug: data.slug },
    });
    if (existing) {
      throw new AppError(400, 'Page with this slug already exists');
    }

    const page = this.pageContentRepo.create(data);
    await this.pageContentRepo.save(page);
    return page;
  }

  async updatePage(id: string, data: Partial<PageContent>) {
    const page = await this.getPageById(id);
    
    // Slug değişiyorsa kontrol et
    if (data.slug && data.slug !== page.slug) {
      const existing = await this.pageContentRepo.findOne({
        where: { slug: data.slug },
      });
      if (existing) {
        throw new AppError(400, 'Page with this slug already exists');
      }
    }

    Object.assign(page, data);
    await this.pageContentRepo.save(page);
    return page;
  }

  async deletePage(id: string) {
    const page = await this.getPageById(id);
    await this.pageContentRepo.remove(page);
    return { message: 'Page deleted successfully' };
  }
}


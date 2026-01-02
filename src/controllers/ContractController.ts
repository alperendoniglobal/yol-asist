import { Request, Response } from 'express';
import { ContractService } from '../services/ContractService';
import { asyncHandler } from '../middlewares/errorHandler';

/**
 * Sözleşme Controller
 * Sözleşme versiyonları ve onay işlemlerini yöneten API endpoint'leri
 */
export class ContractController {
  private contractService = new ContractService();

  /**
   * Aktif sözleşme versiyonunu getirir
   * GET /api/v1/contract/current
   * Public - Herkes erişebilir
   */
  getCurrentVersion = asyncHandler(async (req: Request, res: Response) => {
    const version = await this.contractService.getCurrentVersion();

    if (!version) {
      res.status(404).json({
        success: false,
        message: 'Aktif sözleşme versiyonu bulunamadı',
      });
      return;
    }

    res.json({
      success: true,
      data: version,
    });
  });

  /**
   * Acente için sözleşme durumunu kontrol eder
   * GET /api/v1/contract/status
   * Auth gerekli - Acente kullanıcıları
   */
  checkStatus = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.agency_id) {
      res.status(400).json({
        success: false,
        message: 'Acente bilgisi bulunamadı',
      });
      return;
    }

    const status = await this.contractService.checkContractStatus(req.user.agency_id);

    res.json({
      success: true,
      data: status,
    });
  });

  /**
   * Sözleşmeyi onaylar
   * POST /api/v1/contract/accept
   * Auth gerekli - Acente kullanıcıları
   */
  acceptContract = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.agency_id || !req.user?.id) {
      res.status(400).json({
        success: false,
        message: 'Kullanıcı bilgisi bulunamadı',
      });
      return;
    }

    const { checkbox1_accepted, checkbox2_accepted, scroll_completed } = req.body;

    // IP adresini al (proxy arkasındaysa X-Forwarded-For kullan)
    const ipAddress = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    // User agent bilgisini al
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.contractService.acceptContract({
      agencyId: req.user.agency_id,
      userId: req.user.id,
      ipAddress,
      userAgent,
      checkbox1Accepted: checkbox1_accepted,
      checkbox2Accepted: checkbox2_accepted,
      scrollCompleted: scroll_completed,
    });

    res.json({
      success: true,
      message: result.message,
      data: {
        accepted_at: result.acceptance.accepted_at,
        version: result.acceptance.contract_version_id,
      },
    });
  });

  /**
   * Acente onay geçmişini getirir
   * GET /api/v1/contract/history
   * Auth gerekli - Acente admini veya Super Admin
   */
  getHistory = asyncHandler(async (req: Request, res: Response) => {
    const agencyId = req.params.agencyId || req.user?.agency_id;

    if (!agencyId) {
      res.status(400).json({
        success: false,
        message: 'Acente bilgisi bulunamadı',
      });
      return;
    }

    const history = await this.contractService.getAgencyAcceptanceHistory(agencyId);

    res.json({
      success: true,
      data: history,
    });
  });

  /**
   * Tüm sözleşme versiyonlarını getirir
   * GET /api/v1/contract/versions
   * Auth gerekli - Super Admin
   */
  getAllVersions = asyncHandler(async (req: Request, res: Response) => {
    const versions = await this.contractService.getAllVersions();

    res.json({
      success: true,
      data: versions,
    });
  });

  /**
   * Yeni sözleşme versiyonu oluşturur
   * POST /api/v1/contract/versions
   * Auth gerekli - Super Admin
   */
  createVersion = asyncHandler(async (req: Request, res: Response) => {
    const { version, title, content, summary, change_notes, is_active } = req.body;

    // Validasyon
    if (!version || !title || !content) {
      res.status(400).json({
        success: false,
        message: 'Versiyon, başlık ve içerik zorunludur',
      });
      return;
    }

    const newVersion = await this.contractService.createVersion({
      version,
      title,
      content,
      summary,
      change_notes,
      is_active,
    });

    res.status(201).json({
      success: true,
      message: 'Sözleşme versiyonu oluşturuldu',
      data: newVersion,
    });
  });

  /**
   * Sözleşme versiyonunu günceller
   * PUT /api/v1/contract/versions/:id
   * Auth gerekli - Super Admin
   */
  updateVersion = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { version, title, content, summary, change_notes, is_active } = req.body;

    const updatedVersion = await this.contractService.updateVersion(id, {
      version,
      title,
      content,
      summary,
      change_notes,
      is_active,
    });

    res.json({
      success: true,
      message: 'Sözleşme versiyonu güncellendi',
      data: updatedVersion,
    });
  });

  /**
   * Bir versiyonu aktif yapar
   * POST /api/v1/contract/versions/:id/activate
   * Auth gerekli - Super Admin
   * Not: Bu işlem tüm acentelerin yeniden onay vermesini gerektirir
   */
  activateVersion = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const version = await this.contractService.activateVersion(id);

    res.json({
      success: true,
      message: 'Sözleşme versiyonu aktif edildi. Tüm acentelerin yeniden onay vermesi gerekecektir.',
      data: version,
    });
  });

  /**
   * Onay raporunu getirir
   * GET /api/v1/contract/report
   * Auth gerekli - Super Admin
   */
  getReport = asyncHandler(async (req: Request, res: Response) => {
    const { start_date, end_date, version } = req.query;

    const filters: {
      startDate?: Date;
      endDate?: Date;
      version?: string;
    } = {};

    if (start_date) {
      filters.startDate = new Date(start_date as string);
    }

    if (end_date) {
      filters.endDate = new Date(end_date as string);
    }

    if (version) {
      filters.version = version as string;
    }

    const report = await this.contractService.getAcceptanceReport(filters);

    res.json({
      success: true,
      data: report,
    });
  });

  /**
   * Sözleşmeyi PDF formatında getirir
   * GET /api/v1/contract/pdf
   * GET /api/v1/contract/pdf/:versionId
   * Public - Herkes erişebilir
   */
  getPdf = asyncHandler(async (req: Request, res: Response) => {
    const { versionId } = req.params;

    const pdf = await this.contractService.getContractAsPdf(versionId);

    res.json({
      success: true,
      data: pdf,
    });
  });
}


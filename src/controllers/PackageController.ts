import { Request, Response } from 'express';
import { PackageService } from '../services/PackageService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

/**
 * Paket Controller
 * Sigorta/Yol Asistan paketlerinin API endpoint'leri
 */
export class PackageController {
  private packageService: PackageService;

  constructor() {
    this.packageService = new PackageService();
  }

  // ===== PAKET CRUD =====

  /**
   * Tüm paketleri listele
   * GET /packages
   * Query: ?vehicle_type=Otomobil&status=ACTIVE
   */
  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const packages = await this.packageService.getAll(req.query);
    successResponse(res, packages, 'Paketler başarıyla getirildi');
  });

  /**
   * Paket detayını getir
   * GET /packages/:id
   */
  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const pkg = await this.packageService.getById(id);
    successResponse(res, pkg, 'Paket başarıyla getirildi');
  });

  /**
   * Yeni paket oluştur (Sadece Super Admin)
   * POST /packages
   */
  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const pkg = await this.packageService.create(req.body);
    successResponse(res, pkg, 'Paket başarıyla oluşturuldu', 201);
  });

  /**
   * Paket güncelle (Sadece Super Admin)
   * PUT /packages/:id
   */
  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const pkg = await this.packageService.update(id, req.body);
    successResponse(res, pkg, 'Paket başarıyla güncellendi');
  });

  /**
   * Paket sil (Sadece Super Admin)
   * DELETE /packages/:id
   */
  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.packageService.delete(id);
    successResponse(res, result, 'Paket başarıyla silindi');
  });

  // ===== KAPSAM CRUD =====

  /**
   * Paketin kapsamlarını listele
   * GET /packages/:id/covers
   */
  getCovers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const covers = await this.packageService.getCovers(id);
    successResponse(res, covers, 'Kapsamlar başarıyla getirildi');
  });

  /**
   * Pakete kapsam ekle (Sadece Super Admin)
   * POST /packages/:id/covers
   */
  addCover = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const cover = await this.packageService.addCover(id, req.body);
    successResponse(res, cover, 'Kapsam başarıyla eklendi', 201);
  });

  /**
   * Kapsamı güncelle (Sadece Super Admin)
   * PUT /packages/:id/covers/:coverId
   */
  updateCover = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, coverId } = req.params;
    const cover = await this.packageService.updateCover(id, coverId, req.body);
    successResponse(res, cover, 'Kapsam başarıyla güncellendi');
  });

  /**
   * Kapsamı sil (Sadece Super Admin)
   * DELETE /packages/:id/covers/:coverId
   */
  deleteCover = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, coverId } = req.params;
    const result = await this.packageService.deleteCover(id, coverId);
    successResponse(res, result, 'Kapsam başarıyla silindi');
  });

  // ===== YARDIMCI ENDPOINT'LER =====

  /**
   * Araç türüne göre paketleri getir
   * GET /packages/vehicle-type/:vehicleType
   */
  getByVehicleType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vehicleType } = req.params;
    const packages = await this.packageService.getByVehicleType(vehicleType);
    successResponse(res, packages, 'Paketler başarıyla getirildi');
  });

  /**
   * Araç yaşına uygun paketleri getir (Satış sırasında kullanılır)
   * GET /packages/available?vehicleType=Otomobil&vehicleAge=5
   */
  getAvailablePackages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vehicleType, vehicleAge } = req.query;
    
    if (!vehicleType || !vehicleAge) {
      return successResponse(res, [], 'vehicleType ve vehicleAge parametreleri gerekli');
    }

    const packages = await this.packageService.getAvailablePackages(
      vehicleType as string, 
      parseInt(vehicleAge as string)
    );
    successResponse(res, packages, 'Uygun paketler başarıyla getirildi');
  });
}

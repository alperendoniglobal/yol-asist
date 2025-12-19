import { Request, Response } from 'express';
import { SaleService } from '../services/SaleService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';
import { UserRole } from '../types/enums';

export class SaleController {
  private saleService: SaleService;

  constructor() {
    this.saleService = new SaleService();
  }

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const sales = await this.saleService.getAll(req.tenantFilter);
    
    // BRANCH_USER rolündeki kullanıcılar komisyon bilgisini göremez
    // Komisyon bilgisini response'dan çıkar
    // Sadece Super Admin, Agency Admin ve Branch Admin komisyonu görebilir
    const filteredSales = sales.map(sale => {
      if (req.user?.role === UserRole.BRANCH_USER) {
        const { commission, ...saleWithoutCommission } = sale;
        return saleWithoutCommission;
      }
      return sale;
    });
    
    successResponse(res, filteredSales, 'Sales retrieved successfully');
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const sale = await this.saleService.getById(id);
    
    // BRANCH_USER rolündeki kullanıcılar komisyon bilgisini göremez
    // Komisyon bilgisini response'dan çıkar
    // Sadece Super Admin, Agency Admin ve Branch Admin komisyonu görebilir
    let filteredSale = sale;
    if (req.user?.role === UserRole.BRANCH_USER) {
      const { commission, ...saleWithoutCommission } = sale;
      filteredSale = saleWithoutCommission as any;
    }
    
    successResponse(res, filteredSale, 'Sale retrieved successfully');
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Super Admin için agency_id ve branch_id null kalır = "Sistem" kaydı
    const agency_id = req.user?.agency_id || null;
    const branch_id = req.user?.branch_id || null;

    const saleData = {
      ...req.body,
      agency_id,
      branch_id,
      user_id: req.user?.id,
    };
    const sale = await this.saleService.create(saleData);
    successResponse(res, sale, 'Sale created successfully', 201);
  });

  /**
   * Komple satış işlemi - Transaction içinde tüm adımları yapar
   * Müşteri, araç, satış ve ödeme tek seferde işlenir
   * Herhangi bir adımda hata olursa hiçbir kayıt oluşturulmaz
   */
  completeSale = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customer, vehicle, sale, payment } = req.body;

    // Kullanıcı bilgilerini ekle
    const completeSaleInput = {
      customer,
      vehicle,
      sale,
      payment,
      user_id: req.user?.id,
      agency_id: req.user?.agency_id || null,
      branch_id: req.user?.branch_id || null,
    };

    const result = await this.saleService.completeSale(completeSaleInput);
    
    // BRANCH_USER rolündeki kullanıcılar komisyon bilgisini göremez
    // Komisyon bilgisini response'dan çıkar
    let filteredResult = result;
    if (req.user?.role === UserRole.BRANCH_USER) {
      const { commission, ...resultWithoutCommission } = result;
      filteredResult = resultWithoutCommission as any;
    }
    
    successResponse(res, filteredResult, 'Satış başarıyla tamamlandı', 201);
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const sale = await this.saleService.update(id, req.body);
    successResponse(res, sale, 'Sale updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.saleService.delete(id);
    successResponse(res, result, 'Sale deleted successfully');
  });

  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.saleService.getStats(req.tenantFilter);
    successResponse(res, stats, 'Sales stats retrieved successfully');
  });

  // ===== İADE İŞLEMLERİ =====

  /**
   * İade tutarını hesapla
   * Satışın iade edilmesi durumunda müşteriye ödenecek tutarı hesaplar
   * Formül: (Net Fiyat / 365) × Kalan Gün
   * Net Fiyat = Toplam Fiyat / 1.20 (KDV hariç)
   */
  calculateRefund = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const refundCalculation = await this.saleService.calculateRefund(id);
    successResponse(res, refundCalculation, 'İade tutarı hesaplandı');
  });

  /**
   * İade işlemini gerçekleştir
   * Satışı iptal eder ve iade tutarını hesaplar
   * Bakiyeden ödeme yapılmışsa tutarı bakiyeye iade eder
   */
  processRefund = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;

    // İade sebebi zorunlu
    if (!reason || reason.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'İade sebebi zorunludur'
      });
      return;
    }

    const updatedSale = await this.saleService.processRefund(
      id,
      reason,
      req.user?.id || ''
    );

    successResponse(res, updatedSale, 'İade işlemi başarıyla tamamlandı');
  });
}

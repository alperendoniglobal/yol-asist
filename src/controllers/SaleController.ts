import { Request, Response } from 'express';
import { SaleService } from '../services/SaleService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';
import { UserRole } from '../types/enums';
import ExcelJS from 'exceljs';

export class SaleController {
  private saleService: SaleService;

  constructor() {
    this.saleService = new SaleService();
  }

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { search } = req.query; // Arama sorgusu (opsiyonel)
    
    // SUPPORT rolü için: search parametresi yoksa boş array döndür
    if (req.user?.role === UserRole.SUPPORT && !search) {
      successResponse(res, [], 'No search query provided');
      return;
    }
    
    const sales = await this.saleService.getAll(
      req.tenantFilter, 
      search as string | undefined,
      req.user?.role // User role'ü geçir
    );
    
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

  /**
   * Excel export - Satışları Excel formatında indir
   * Rol bazlı filtreleme otomatik olarak uygulanır (tenantFilter)
   * Tarih aralığı filtresi opsiyonel olarak query parametrelerinden alınır
   */
  export = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Query parametrelerinden tarih aralığı al
    const { startDate, endDate } = req.query;
    
    // SaleService'den filtreli satışları çek (tenantFilter + tarih aralığı)
    const sales = await this.saleService.getForExport(
      req.tenantFilter,
      startDate as string | undefined,
      endDate as string | undefined
    );
    
    // Excel dosyası oluştur
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Satışlar');
    
    // Komisyon görüntüleme yetkisi kontrolü
    const canViewCommission = req.user?.role === UserRole.SUPER_ADMIN 
      || req.user?.role === UserRole.AGENCY_ADMIN 
      || req.user?.role === UserRole.BRANCH_ADMIN;
    
    // Kolon başlıkları
    const headers = [
      'Satış No',
      'Müşteri Adı',
      'Müşteri Soyadı',
      'TC/VKN',
      'Telefon',
      'Araç Plakası',
      'Paket Adı',
      'Başlangıç Tarihi',
      'Bitiş Tarihi',
      'Fiyat (TL)',
    ];
    
    // Komisyon kolonu sadece yetkisi olanlar için
    if (canViewCommission) {
      headers.push('Komisyon (TL)');
    }
    
    headers.push(
      'Acente Adı',
      'Şube Adı',
      'Personel Adı',
      'Personel Soyadı',
      'Durum',
      'İade Tarihi',
      'İade Tutarı (TL)',
      'İade Sebebi',
      'Oluşturulma Tarihi'
    );
    
    // Başlık satırını ekle
    worksheet.addRow(headers);
    
    // Başlık satırını formatla
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;
    
    // Veri satırlarını ekle
    sales.forEach((sale) => {
      const today = new Date();
      const endDate = new Date(sale.end_date);
      let status = 'Aktif';
      if (sale.is_refunded) {
        status = 'İade Edildi';
      } else if (endDate < today) {
        status = 'Süresi Dolmuş';
      }
      
      const row = [
        sale.policy_number || sale.id.slice(0, 8).toUpperCase(), // Satış No (policy_number yoksa ID'nin ilk 8 karakteri)
        sale.customer?.name || '',
        sale.customer?.surname || '',
        sale.customer?.tc_vkn || '',
        sale.customer?.phone || '',
        sale.vehicle?.plate || '',
        sale.package?.name || '',
        sale.start_date ? new Date(sale.start_date).toLocaleDateString('tr-TR') : '',
        sale.end_date ? new Date(sale.end_date).toLocaleDateString('tr-TR') : '',
        parseFloat(sale.price.toString()).toFixed(2),
      ];
      
      // Komisyon kolonu sadece yetkisi olanlar için
      if (canViewCommission) {
        row.push(parseFloat(sale.commission.toString()).toFixed(2));
      }
      
      row.push(
        (sale.agency as any)?.name || '',
        (sale.branch as any)?.name || '',
        sale.user?.name || '',
        sale.user?.surname || '',
        status,
        sale.refunded_at ? new Date(sale.refunded_at).toLocaleDateString('tr-TR') : '',
        sale.refund_amount ? parseFloat(sale.refund_amount.toString()).toFixed(2) : '',
        sale.refund_reason || '',
        sale.created_at ? new Date(sale.created_at).toLocaleDateString('tr-TR') : ''
      );
      
      worksheet.addRow(row);
    });
    
    // Kolon genişliklerini ayarla
    worksheet.columns.forEach((column, index) => {
      if (index === 0) {
        // Satış No kolonu
        column.width = 15;
      } else if (index >= 1 && index <= 4) {
        // Müşteri bilgileri
        column.width = 15;
      } else if (index === 5) {
        // Araç Plakası
        column.width = 12;
      } else if (index === 6) {
        // Paket Adı
        column.width = 20;
      } else if (index >= 7 && index <= 8) {
        // Tarihler
        column.width = 12;
      } else if (index === 9 || (canViewCommission && index === 10)) {
        // Fiyat ve Komisyon
        column.width = 12;
        column.numFmt = '#,##0.00';
      } else if (index === (canViewCommission ? 11 : 10) || index === (canViewCommission ? 12 : 11)) {
        // Acente ve Şube
        column.width = 20;
      } else if (index >= (canViewCommission ? 13 : 12) && index <= (canViewCommission ? 14 : 13)) {
        // Personel bilgileri
        column.width = 15;
      } else if (index === (canViewCommission ? 15 : 14)) {
        // Durum
        column.width = 15;
      } else if (index === (canViewCommission ? 16 : 15)) {
        // İade Tarihi
        column.width = 12;
      } else if (index === (canViewCommission ? 17 : 16)) {
        // İade Tutarı
        column.width = 15;
        column.numFmt = '#,##0.00';
      } else if (index === (canViewCommission ? 18 : 17)) {
        // İade Sebebi
        column.width = 30;
      } else {
        // Oluşturulma Tarihi
        column.width = 12;
      }
    });
    
    // Tüm hücrelere border ekle
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
    });
    
    // Excel dosyasını response olarak gönder
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="satislar_${Date.now()}.xlsx"`);
    
    await workbook.xlsx.write(res);
    res.end();
  });
}

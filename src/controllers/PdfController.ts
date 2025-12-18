import { Request, Response } from 'express';
import { PdfService } from '../services/PdfService';

/**
 * PDF Controller
 * Satis belgelerini PDF olarak olusturur ve indirir
 */
export class PdfController {
  private pdfService = new PdfService();

  /**
   * Satis icin PDF police belgesi olusturur
   * GET /api/v1/pdf/sale/:id
   */
  generateSaleContract = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Satis ID gereklidir' 
        });
      }

      // PDF olustur
      const pdfBuffer = await this.pdfService.generateSaleContract(id);

      // Response headers
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="sozlesme-${id.slice(0, 8)}.pdf"`,
        'Content-Length': pdfBuffer.length
      });

      // PDF'i gonder
      res.send(pdfBuffer);

    } catch (error: any) {
      console.error('PDF olusturma hatasi:', error);
      
      if (error.message === 'Satis bulunamadi') {
        return res.status(404).json({ 
          success: false, 
          error: 'Satis bulunamadi' 
        });
      }

      res.status(500).json({ 
        success: false, 
        error: 'PDF olusturulurken bir hata olustu' 
      });
    }
  };

  /**
   * Satis PDF'ini tarayicida goruntuler (inline)
   * GET /api/v1/pdf/sale/:id/view
   */
  viewSaleContract = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Satis ID gereklidir' 
        });
      }

      // PDF olustur
      const pdfBuffer = await this.pdfService.generateSaleContract(id);

      // Response headers - inline gosterim
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="sozlesme-${id.slice(0, 8)}.pdf"`,
        'Content-Length': pdfBuffer.length
      });

      // PDF'i gonder
      res.send(pdfBuffer);

    } catch (error: any) {
      console.error('PDF goruntuleme hatasi:', error);
      
      if (error.message === 'Satis bulunamadi') {
        return res.status(404).json({ 
          success: false, 
          error: 'Satis bulunamadi' 
        });
      }

      res.status(500).json({ 
        success: false, 
        error: 'PDF goruntulenirken bir hata olustu' 
      });
    }
  };
}


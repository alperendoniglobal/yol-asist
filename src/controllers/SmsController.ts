import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/errorHandler';
import { SmsService } from '../services/SmsService';

const smsService = new SmsService();

/**
 * SMS Controller
 * SMS gönderme işlemlerini yönetir
 */
export class SmsController {
  /**
   * Tek bir SMS gönder
   * POST /api/sms/send
   * Body: { phoneNumber: string, message: string }
   */
  sendSingle = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumber, message } = req.body;

    // Validasyon
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'phoneNumber ve message alanları zorunludur',
      });
    }

    // SMS gönder
    const result = await smsService.sendSingleSms(phoneNumber, message);

    res.status(200).json({
      success: true,
      message: 'SMS başarıyla gönderildi',
      data: result,
    });
  });

  /**
   * Toplu SMS gönder
   * POST /api/sms/send-bulk
   * Body: { messages: [{ no: string, msg: string }] }
   */
  sendBulk = asyncHandler(async (req: Request, res: Response) => {
    const { messages } = req.body;

    // Validasyon
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'messages alanı zorunludur ve en az bir mesaj içermelidir',
      });
    }

    // Her mesajın no ve msg alanlarını kontrol et
    for (const msg of messages) {
      if (!msg.no || !msg.msg) {
        return res.status(400).json({
          success: false,
          message: 'Her mesaj no ve msg alanlarını içermelidir',
        });
      }
    }

    // SMS gönder
    const result = await smsService.sendBulkSms(messages);

    res.status(200).json({
      success: true,
      message: 'SMS\'ler başarıyla gönderildi',
      data: result,
    });
  });

  /**
   * Çoklu telefon numarasına aynı mesajı gönder
   * POST /api/sms/send-multiple
   * Body: { phoneNumbers: string[], message: string }
   */
  sendToMultiple = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumbers, message } = req.body;

    // Validasyon
    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'phoneNumbers alanı zorunludur ve en az bir telefon numarası içermelidir',
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'message alanı zorunludur',
      });
    }

    // SMS gönder
    const result = await smsService.sendToMultipleNumbers(phoneNumbers, message);

    res.status(200).json({
      success: true,
      message: 'SMS\'ler başarıyla gönderildi',
      data: result,
    });
  });
}


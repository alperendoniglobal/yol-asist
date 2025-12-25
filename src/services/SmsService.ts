import axios from 'axios';
import { AppError } from '../middlewares/errorHandler';

// NetGSM SMS API için interface'ler
interface SmsMessage {
  msg: string;
  no: string;
}

interface SmsRequest {
  msgheader: string;
  messages: SmsMessage[];
  encoding?: string;
  iysfilter?: string;
  partnercode?: string;
}

interface SmsResponse {
  status: string;
  message?: string;
  data?: any;
}

/**
 * NetGSM SMS Servisi
 * SMS gönderme işlemlerini yönetir
 */
export class SmsService {
  private readonly apiUrl = 'https://api.netgsm.com.tr/sms/rest/v2/send';
  private readonly username: string;
  private readonly password: string;
  private readonly msgheader: string;

  constructor() {
    // Environment variables'dan NetGSM bilgilerini al
    this.username = process.env.NETGSM_USERNAME || '';
    this.password = process.env.NETGSM_PASSWORD || '';
    this.msgheader = process.env.NETGSM_MSGHEADER || '';

    // Gerekli bilgilerin varlığını kontrol et
    if (!this.username || !this.password || !this.msgheader) {
      console.warn('NetGSM credentials not configured. SMS service will not work.');
    }
  }

  /**
   * Base64 encoding için helper fonksiyon
   */
  private encodeBase64(text: string): string {
    return Buffer.from(text).toString('base64');
  }

  /**
   * Authorization header'ı oluştur
   */
  private getAuthHeader(): string {
    const credentials = `${this.username}:${this.password}`;
    return `Basic ${this.encodeBase64(credentials)}`;
  }

  /**
   * Tek bir SMS gönder
   * @param phoneNumber - Alıcı telefon numarası (örn: "5101234567")
   * @param message - Gönderilecek mesaj
   * @returns Gönderim sonucu
   */
  async sendSingleSms(phoneNumber: string, message: string): Promise<SmsResponse> {
    return this.sendBulkSms([{ no: phoneNumber, msg: message }]);
  }

  /**
   * Toplu SMS gönder
   * @param messages - Gönderilecek mesajlar listesi
   * @returns Gönderim sonucu
   */
  async sendBulkSms(messages: SmsMessage[]): Promise<SmsResponse> {
    // Credentials kontrolü
    if (!this.username || !this.password || !this.msgheader) {
      throw new AppError(500, 'NetGSM credentials not configured');
    }

    // Mesaj listesi kontrolü
    if (!messages || messages.length === 0) {
      throw new AppError(400, 'At least one message is required');
    }

    // Telefon numaralarını temizle ve formatla (başında 0 varsa kaldır, +90 varsa kaldır)
    const formattedMessages = messages.map((msg) => {
      let phoneNumber = msg.no.replace(/\s+/g, ''); // Boşlukları kaldır
      
      // +90 ile başlıyorsa kaldır
      if (phoneNumber.startsWith('+90')) {
        phoneNumber = phoneNumber.substring(3);
      }
      
      // 0 ile başlıyorsa kaldır
      if (phoneNumber.startsWith('0')) {
        phoneNumber = phoneNumber.substring(1);
      }
      
      // Sadece rakamlar kalmalı
      phoneNumber = phoneNumber.replace(/\D/g, '');

      return {
        msg: msg.msg,
        no: phoneNumber,
      };
    });

    // Request body oluştur
    const requestBody: SmsRequest = {
      msgheader: this.msgheader,
      messages: formattedMessages,
      encoding: 'TR', // Türkçe karakter desteği
      iysfilter: '',
      partnercode: '',
    };

    try {
      // API'ye istek gönder
      const response = await axios.post(this.apiUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader(),
        },
        timeout: 30000, // 30 saniye timeout
      });

      // Başarılı yanıt
      return {
        status: 'success',
        message: 'SMS sent successfully',
        data: response.data,
      };
    } catch (error: any) {
      // Hata durumunda detaylı bilgi logla
      console.error('NetGSM SMS Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      // NetGSM'den gelen hata mesajını parse et
      const netgsmError = error.response?.data;
      let errorMessage = 'SMS gönderilemedi';
      
      if (netgsmError) {
        // NetGSM hata kodlarına göre açıklayıcı mesajlar
        if (netgsmError.code === '40' || netgsmError.description === 'invalidHeader') {
          errorMessage = `Geçersiz SMS başlığı (msgheader). Lütfen NetGSM panelinden onaylı başlık kodunuzu veya adınızı kontrol edin. Gönderilen değer: "${this.msgheader}"`;
        } else if (netgsmError.description) {
          errorMessage = `NetGSM Hatası: ${netgsmError.description} (Kod: ${netgsmError.code || 'Bilinmiyor'})`;
        } else if (netgsmError.message) {
          errorMessage = netgsmError.message;
        }
      } else {
        errorMessage = error.message || 'SMS gönderilemedi';
      }
      
      throw new AppError(
        error.response?.status || 500,
        `SMS gönderim hatası: ${errorMessage}`
      );
    }
  }

  /**
   * Çoklu telefon numarasına aynı mesajı gönder
   * @param phoneNumbers - Alıcı telefon numaraları listesi
   * @param message - Gönderilecek mesaj
   * @returns Gönderim sonucu
   */
  async sendToMultipleNumbers(phoneNumbers: string[], message: string): Promise<SmsResponse> {
    const messages: SmsMessage[] = phoneNumbers.map((phone) => ({
      no: phone,
      msg: message,
    }));

    return this.sendBulkSms(messages);
  }
}


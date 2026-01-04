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
   * Telefon numarasını formatla ve validate et
   * @param phoneNumber - Ham telefon numarası (örn: "05432550641", "+905432550641", "5432550641")
   * @returns Formatlanmış telefon numarası (örn: "5432550641")
   */
  private formatPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) {
      throw new AppError(400, 'Telefon numarası boş olamaz');
    }

    // Boşlukları ve özel karakterleri kaldır
    let formatted = phoneNumber.replace(/\s+/g, '').replace(/[()-]/g, '');
    
    // +90 ile başlıyorsa kaldır
    if (formatted.startsWith('+90')) {
      formatted = formatted.substring(3);
    }
    
    // 90 ile başlıyorsa kaldır (uluslararası format)
    if (formatted.startsWith('90') && formatted.length === 12) {
      formatted = formatted.substring(2);
    }
    
    // 0 ile başlıyorsa kaldır
    if (formatted.startsWith('0')) {
      formatted = formatted.substring(1);
    }
    
    // Sadece rakamlar kalmalı
    formatted = formatted.replace(/\D/g, '');

    // Validasyon: 10 haneli olmalı ve 5 ile başlamalı (Türkiye cep telefonu)
    if (formatted.length !== 10) {
      throw new AppError(400, `Geçersiz telefon numarası formatı. 10 haneli olmalı. Gelen: ${phoneNumber}, Formatlanmış: ${formatted}`);
    }

    if (!formatted.startsWith('5')) {
      throw new AppError(400, `Geçersiz telefon numarası. Türkiye cep telefonu numarası 5 ile başlamalı. Gelen: ${phoneNumber}, Formatlanmış: ${formatted}`);
    }

    return formatted;
  }

  /**
   * Tek bir SMS gönder
   * @param phoneNumber - Alıcı telefon numarası (örn: "05432550641", "+905432550641", "5432550641")
   * @param message - Gönderilecek mesaj
   * @returns Gönderim sonucu
   */
  async sendSingleSms(phoneNumber: string, message: string): Promise<SmsResponse> {
    console.log('📱 SMS gönderme işlemi başlatıldı');
    console.log(`📱 Ham telefon numarası: "${phoneNumber}"`);
    console.log(`📱 Mesaj uzunluğu: ${message.length} karakter`);
    
    // Telefon numarasını formatla ve validate et
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    console.log(`✅ Telefon numarası formatlandı: "${phoneNumber}" -> "${formattedPhone}"`);
    
    const result = await this.sendBulkSms([{ no: formattedPhone, msg: message }]);
    console.log(`✅ SMS gönderme işlemi tamamlandı - Durum: ${result.status}`);
    
    return result;
  }

  /**
   * Toplu SMS gönder
   * @param messages - Gönderilecek mesajlar listesi
   * @returns Gönderim sonucu
   */
  async sendBulkSms(messages: SmsMessage[]): Promise<SmsResponse> {
    console.log('📤 Toplu SMS gönderme işlemi başlatıldı');
    console.log(`📤 Toplam mesaj sayısı: ${messages?.length || 0}`);
    
    // Credentials kontrolü
    if (!this.username || !this.password || !this.msgheader) {
      console.error('❌ NetGSM credentials eksik!');
      throw new AppError(500, 'NetGSM credentials not configured');
    }
    console.log(`✅ NetGSM credentials kontrol edildi - Username: ${this.username}, MsgHeader: ${this.msgheader}`);

    // Mesaj listesi kontrolü
    if (!messages || messages.length === 0) {
      console.error('❌ Mesaj listesi boş!');
      throw new AppError(400, 'At least one message is required');
    }

    // Telefon numaralarını formatla ve validate et
    console.log('🔄 Telefon numaraları formatlanıyor...');
    const formattedMessages = messages.map((msg, index) => {
      try {
        const formattedPhone = this.formatPhoneNumber(msg.no);
        console.log(`  ${index + 1}. "${msg.no}" -> "${formattedPhone}" (Mesaj uzunluğu: ${msg.msg.length} karakter)`);
        return {
          msg: msg.msg,
          no: formattedPhone,
        };
      } catch (error: any) {
        // Hatalı numaraları logla ve atla
        console.error(`❌ Geçersiz telefon numarası atlandı: ${msg.no} - ${error.message}`);
        throw error; // Hatalı numara varsa tüm işlemi durdur
      }
    });
    console.log(`✅ ${formattedMessages.length} telefon numarası başarıyla formatlandı`);

    // Request body oluştur
    const requestBody: SmsRequest = {
      msgheader: this.msgheader,
      messages: formattedMessages,
      encoding: 'TR', // Türkçe karakter desteği
      iysfilter: '',
      partnercode: '',
    };

    console.log('🌐 NetGSM API\'ye istek gönderiliyor...');
    console.log(`🌐 API URL: ${this.apiUrl}`);
    console.log(`🌐 Request Body:`, JSON.stringify({
      ...requestBody,
      messages: requestBody.messages.map(m => ({ no: m.no, msg: `${m.msg.substring(0, 50)}...` })) // Mesajın ilk 50 karakterini göster
    }, null, 2));

    const startTime = Date.now();
    try {
      
      // API'ye istek gönder
      const response = await axios.post(this.apiUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader(),
        },
        timeout: 30000, // 30 saniye timeout
      });

      const duration = Date.now() - startTime;
      console.log(`✅ NetGSM API yanıtı alındı (${duration}ms)`);
      console.log(`✅ Response Status: ${response.status}`);
      console.log(`✅ Response Data:`, JSON.stringify(response.data, null, 2));

      // Başarılı yanıt
      const result = {
        status: 'success',
        message: 'SMS sent successfully',
        data: response.data,
      };
      
      console.log(`✅ SMS gönderme başarılı!`);
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ NetGSM API hatası (${duration}ms)`);
      console.error(`❌ Error Message: ${error.message}`);
      console.error(`❌ Error Status: ${error.response?.status || 'N/A'}`);
      console.error(`❌ Error Response Data:`, JSON.stringify(error.response?.data || {}, null, 2));
      console.error(`❌ Full Error:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack,
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
      
      console.error(`❌ SMS gönderme hatası: ${errorMessage}`);
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


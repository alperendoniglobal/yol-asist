import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';

/**
 * PayTR iFrame API Service
 * PayTR ödeme sistemi entegrasyonu için service
 * 
 * PayTR asenkron çalışır:
 * 1. Token alma: Frontend'den token isteği gelir, PayTR'den token alınır
 * 2. Iframe gösterimi: Frontend'de iframe ile ödeme formu gösterilir
 * 3. Bildirim: PayTR ödeme sonucunu callback URL'ye POST ile gönderir
 */
export class PayTRService {
  private merchantId: string;
  private merchantKey: string;
  private merchantSalt: string;
  private baseUrl: string;
  private notificationUrl: string;

  constructor() {
    this.merchantId = config.paytr.merchantId;
    this.merchantKey = config.paytr.merchantKey;
    this.merchantSalt = config.paytr.merchantSalt;
    this.baseUrl = config.paytr.baseUrl || 'https://www.paytr.com';
    this.notificationUrl = config.paytr.notificationUrl || '';
  }

  /**
   * PayTR Token oluşturma (HMAC-SHA256 hash)
   * PayTR resmi örnek koduna göre:
   * 1. Hash string: merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
   * 2. paytr_token = hashSTR + merchant_salt
   * 3. token = HMAC-SHA256(paytr_token, merchant_key)
   */
  private createPaytrToken(data: {
    merchantId: string;
    userIp: string;
    merchantOid: string;
    email: string;
    paymentAmount: number;
    userBasket: string;
    noInstallment: number;
    maxInstallment: number;
    currency: string;
    testMode: number;
  }): string {
    // PayTR hash string formatı: merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
    // Tüm değerler string olarak birleştirilmeli, boşluk olmamalı
    const hashSTR = 
      String(data.merchantId || '').trim() +
      String(data.userIp || '').trim() +
      String(data.merchantOid || '').trim() +
      String(data.email || '').trim() +
      String(data.paymentAmount || 0).trim() +
      String(data.userBasket || '').trim() +
      String(data.noInstallment || 0).trim() +
      String(data.maxInstallment || 0).trim() +
      String(data.currency || 'TL').trim() +
      String(data.testMode || 0).trim();

    // paytr_token = hashSTR + merchant_salt
    const paytr_token = hashSTR + String(this.merchantSalt || '').trim();

    // token = HMAC-SHA256(paytr_token, merchant_key)
    const token = crypto
      .createHmac('sha256', this.merchantKey)
      .update(paytr_token)
      .digest('base64');

    return token;
  }

  /**
   * Bildirim hash doğrulama
   * PayTR bildirim hash formülü: merchant_oid + merchant_salt + status + total_amount
   * 
   * @param merchantOid - Sipariş numarası (sale_id)
   * @param status - Ödeme durumu ('success' veya 'failed')
   * @param totalAmount - Toplam tutar (kuruş cinsinden string)
   * @param receivedHash - PayTR'dan gelen hash
   * @returns Hash doğru mu?
   */
  verifyCallbackHash(
    merchantOid: string,
    status: string,
    totalAmount: string,
    receivedHash: string
  ): boolean {
    // PayTR bildirim hash formülü
    const hashString = merchantOid + this.merchantSalt + status + totalAmount;
    const calculatedHash = crypto
      .createHmac('sha256', this.merchantKey)
      .update(hashString)
      .digest('base64');

    return calculatedHash === receivedHash;
  }

  /**
   * Eski hash doğrulama metodu (geriye dönük uyumluluk için)
   * @deprecated verifyCallbackHash kullanın
   */
  verifyHash(merchantOid: string, receivedHash: string): boolean {
    // Eski metod - sadece merchant_oid + salt kullanıyor (yanlış)
    // Bu metod artık kullanılmamalı
    console.warn('verifyHash deprecated, use verifyCallbackHash instead');
    const hashString = merchantOid + this.merchantSalt;
    const calculatedHash = crypto
      .createHmac('sha256', this.merchantKey)
      .update(hashString)
      .digest('base64');

    return calculatedHash === receivedHash;
  }

  /**
   * Sepet içeriğini base64 encode etme
   * Format: [["Ürün Adı", "Birim Fiyat", Adet], ...]
   */
  createBasket(items: Array<{ name: string; price: number; quantity: number }>): string {
    const basket = items.map(item => {
      // price'ı number'a çevir (string olarak gelebilir)
      const price = typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0);
      return [
        item.name,
        price.toFixed(2),
        item.quantity,
      ];
    });

    return Buffer.from(JSON.stringify(basket)).toString('base64');
  }

  /**
   * UUID'yi PayTR için alfanumerik hale getir (tireleri kaldır)
   * PayTR merchant_oid sadece alfanumerik karakter kabul eder
   */
  sanitizeMerchantOid(merchantOid: string): string {
    // UUID formatındaki tireleri kaldır (örn: "10b561c9-5160-4c83-b0b8-4f675673a192" -> "10b561c951604c83b0b84f675673a192")
    return merchantOid.replace(/-/g, '');
  }

  /**
   * Kullanıcı IP adresini al
   * Proxy arkasındaysa X-Forwarded-For header'ını kontrol et
   * PayTR IP adresini zorunlu kılıyor, boş olamaz
   */
  getUserIp(req: any): string {
    // Test IP (development modunda localhost yerine kullanılacak)
    const TEST_IP = '213.14.134.76';
    
    // 1. X-Forwarded-For header'ını kontrol et (proxy/load balancer arkasında)
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      // X-Forwarded-For birden fazla IP içerebilir, ilkini al
      const ip = forwardedFor.split(',')[0].trim();
      if (ip) {
        // Development modunda localhost IP'si gelirse test IP kullan
        if (process.env.NODE_ENV === 'development' && (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost')) {
          return TEST_IP;
        }
        return ip;
      }
    }

    // 2. X-Real-IP header'ını kontrol et
    const clientIp = req.headers['x-real-ip'] as string;
    if (clientIp && clientIp.trim()) {
      const ip = clientIp.trim();
      // Development modunda localhost IP'si gelirse test IP kullan
      if (process.env.NODE_ENV === 'development' && (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost')) {
        return TEST_IP;
      }
      return ip;
    }

    // 3. req.ip (Express trust proxy ile)
    if (req.ip) {
      // Development modunda localhost IP'lerini test IP'sine çevir
      if (process.env.NODE_ENV === 'development') {
        if (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1' || req.ip === 'localhost') {
          return '213.14.134.76';
        }
      }
      // IPv6 localhost'u IPv4'e çevir
      if (req.ip === '::1' || req.ip === '::ffff:127.0.0.1') {
        return '127.0.0.1';
      }
      if (req.ip !== '::') {
        return req.ip;
      }
    }

    // 4. req.socket.remoteAddress
    if (req.socket?.remoteAddress) {
      const ip = req.socket.remoteAddress;
      if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        // Development modunda test IP kullan (PayTR localhost IP kabul etmiyor)
        if (process.env.NODE_ENV === 'development') {
          return '213.14.134.76';
        }
        return '127.0.0.1';
      }
      if (ip && ip !== '::') {
        return ip;
      }
    }

    // 5. Varsayılan: Development modunda test IP kullan, production'da localhost
    // ⚠️ ÖNEMLİ: PayTR test ortamında localhost IP (127.0.0.1) kabul etmeyebilir!
    // Development modunda test için gerçek bir dış IP adresi kullanıyoruz
    if (process.env.NODE_ENV === 'development') {
      const testIp = '213.14.134.76'; // Test için kullanılacak IP
      console.warn(`IP address could not be determined, using test IP: ${testIp}`);
      return testIp;
    }
    
    const defaultIp = '127.0.0.1';
    console.warn(`IP address could not be determined, using ${defaultIp}`);
    return defaultIp;
  }

  /**
   * PayTR iFrame Token alma (1. Adım)
   * 
   * @param data - Token alma için gerekli bilgiler
   * @returns PayTR token
   */
  async getToken(data: {
    merchantOid: string;
    email: string;
    paymentAmount: number; // Kuruş cinsinden (örn: 34.56 TL = 3456)
    currency?: string;
    userBasket: string; // Base64 encoded JSON
    userIp: string;
    userName?: string;
    userAddress?: string;
    userPhone?: string;
    merchantOkUrl?: string;
    merchantFailUrl?: string;
    noInstallment?: number; // 0 veya 1
    maxInstallment?: number; // 0,2,3,4,5,6,7,8,9,10,11,12
    timeoutLimit?: number; // Dakika cinsinden
    lang?: string; // 'tr' veya 'en'
    testMode?: number; // 0 veya 1
    debugOn?: number; // 0 veya 1
  }): Promise<{ status: string; token?: string; reason?: string }> {
    try {
      // Eğer PayTR bilgileri yapılandırılmamışsa, mock response döndür
      if (!this.merchantId || !this.merchantKey || !this.merchantSalt) {
        console.warn('PayTR credentials not configured, returning mock token');
        return {
          status: 'success',
          token: `MOCK_TOKEN_${Date.now()}`,
        };
      }

      const currency = data.currency || 'TL';
      const noInstallment = data.noInstallment ?? 0;
      const maxInstallment = data.maxInstallment ?? 0;
      const timeoutLimit = data.timeoutLimit || 30;
      const lang = data.lang || 'tr';
      const testMode = data.testMode ?? 0;
      const debugOn = data.debugOn ?? 0;

      // merchant_oid'yi alfanumerik hale getir (PayTR tire kabul etmiyor)
      const sanitizedMerchantOid = this.sanitizeMerchantOid(data.merchantOid);

      // PayTR token oluştur
      // PayTR resmi örnek koduna göre hash string: merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
      const paytrToken = this.createPaytrToken({
        merchantId: this.merchantId,
        userIp: data.userIp,
        merchantOid: sanitizedMerchantOid,
        email: data.email,
        paymentAmount: data.paymentAmount, // Kuruş cinsinden (örn: 3456 = 34.56 TL)
        userBasket: data.userBasket, // Base64 encoded
        noInstallment,
        maxInstallment,
        currency,
        testMode, // PayTR hash string'ine test_mode dahil edilmeli
      });
      
      // Debug: Hash string'ini logla (sadece development'ta)
      if (process.env.NODE_ENV === 'development') {
        const hashSTR = 
          this.merchantId +
          data.userIp +
          sanitizedMerchantOid +
          data.email +
          data.paymentAmount.toString() +
          data.userBasket +
          noInstallment.toString() +
          maxInstallment.toString() +
          currency +
          testMode.toString();
        const paytr_token = hashSTR + this.merchantSalt;
        console.log('=== PayTR Token Debug ===');
        console.log('User IP:', data.userIp || '(EMPTY!)');
        console.log('Merchant ID:', this.merchantId);
        console.log('Merchant OID (sanitized):', sanitizedMerchantOid);
        console.log('Email:', data.email);
        console.log('Payment Amount:', data.paymentAmount);
        console.log('User Basket (first 30 chars):', data.userBasket.substring(0, 30) + '...');
        console.log('No Installment:', noInstallment);
        console.log('Max Installment:', maxInstallment);
        console.log('Currency:', currency);
        console.log('Test Mode:', testMode);
        console.log('Hash STR (first 100 chars):', hashSTR.substring(0, 100) + '...');
        console.log('Hash STR Length:', hashSTR.length);
        console.log('PayTR Token (first 30 chars):', paytrToken.substring(0, 30) + '...');
        console.log('========================');
      }

      // POST request data
      // PayTR payment_amount'u kuruş cinsinden string olarak bekliyor
      const postData: any = {
        merchant_id: this.merchantId,
        user_ip: data.userIp,
        merchant_oid: sanitizedMerchantOid,
        email: data.email,
        payment_amount: String(data.paymentAmount), // Kuruş cinsinden string
        paytr_token: paytrToken,
        user_basket: data.userBasket,
        no_installment: noInstallment,
        max_installment: maxInstallment,
        currency: currency,
        timeout_limit: timeoutLimit,
        lang: lang,
        test_mode: testMode,
        debug_on: debugOn,
      };

      // Opsiyonel alanlar - boş string kontrolü yap
      if (data.userName && data.userName.trim()) {
        postData.user_name = data.userName;
      }
      // PayTR user_address zorunlu görünüyor, boşsa varsayılan değer gönder
      if (data.userAddress && data.userAddress.trim()) {
        postData.user_address = data.userAddress;
      } else {
        // Adres yoksa varsayılan değer gönder (PayTR zorunlu kılıyor)
        postData.user_address = 'Belirtilmemiş';
      }
      if (data.userPhone && data.userPhone.trim()) {
        postData.user_phone = data.userPhone;
      }
      if (data.merchantOkUrl) {
        postData.merchant_ok_url = data.merchantOkUrl;
      }
      if (data.merchantFailUrl) {
        postData.merchant_fail_url = data.merchantFailUrl;
      }

      // PayTR API'ye istek gönder
      const response = await axios.post(
        `${this.baseUrl}/odeme/api/get-token`,
        postData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 20000,
        }
      );

      if (response.data.status === 'success') {
        return {
          status: 'success',
          token: response.data.token,
        };
      } else {
        return {
          status: 'failed',
          reason: response.data.reason || 'Token alınamadı',
        };
      }
    } catch (error: any) {
      console.error('PayTR token error:', error);
      throw new Error(
        error.response?.data?.reason || error.message || 'PayTR token alma başarısız'
      );
    }
  }
}


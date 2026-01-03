# PayTR Ödeme Entegrasyonu Kurulum Rehberi

Bu dokümantasyon, PayTR ödeme entegrasyonunu kurmak için gerekli adımları açıklar.

## 1. PayTR Hesabı Oluşturma

### Adımlar:
1. **PayTR Web Sitesine Gidin**
   - https://www.paytr.com adresine gidin
   - "Mağaza Oluştur" veya "Kayıt Ol" butonuna tıklayın

2. **Hesap Bilgilerini Doldurun**
   - İşletme bilgilerinizi girin
   - İletişim bilgilerinizi girin
   - Banka hesap bilgilerinizi girin (ödeme almak için)

3. **Belgeleri Yükleyin**
   - Kimlik belgesi
   - Vergi levhası veya faaliyet belgesi
   - İmza sirküleri (şirket ise)
   - Banka hesap dekontu

4. **Onay Süreci**
   - PayTR ekibi belgelerinizi inceler
   - Onay süreci genellikle 1-3 iş günü sürer
   - Onaylandıktan sonra mağaza panelinize erişebilirsiniz

## 2. Merchant Bilgilerini Alma

### PayTR Mağaza Paneline Giriş:
1. https://www.paytr.com adresinden giriş yapın
2. Sol menüden **"Bilgi"** veya **"API Bilgileri"** bölümüne gidin
3. Aşağıdaki bilgileri kopyalayın:

   - **Mağaza No (Merchant ID)**: Örnek: `1234567`
   - **Mağaza Anahtarı (Merchant Key)**: Örnek: `abcdefghijklmnopqrstuvwxyz123456`
   - **Mağaza Gizli Anahtarı (Merchant Salt)**: Örnek: `9876543210zyxwvutsrqponmlkjihgfedcba`

⚠️ **ÖNEMLİ**: Bu bilgileri güvenli tutun ve asla paylaşmayın!

## 3. PayTR Panelinde Bildirim URL Ayarlama

### Adımlar:
1. PayTR mağaza panelinde sol menüden **"Ayarlar"** > **"Bildirim URL"** veya **"Entegrasyon Ayarları"** bölümüne gidin

2. **Bildirim URL'ini** aşağıdaki formatta girin:

   **Test Ortamı için:**
   ```
   http://localhost:3000/api/v1/payments/paytr/callback
   ```
   
   **Canlı Ortam için:**
   ```
   https://yourdomain.com/api/v1/payments/paytr/callback
   ```
   
   ⚠️ **ÖNEMLİ**: 
   - URL mutlaka `http://` veya `https://` ile başlamalı
   - URL'nin sonunda `/` olmamalı
   - Canlı ortamda mutlaka HTTPS kullanılmalı

3. **Kaydet** butonuna tıklayın

## 4. Environment Variables Ayarlama

Backend klasöründeki `.env` dosyasına aşağıdaki bilgileri ekleyin:

```env
# PayTR Ödeme Entegrasyonu
PAYTR_MERCHANT_ID=1234567
PAYTR_MERCHANT_KEY=your_merchant_key_here
PAYTR_MERCHANT_SALT=your_merchant_salt_here
PAYTR_NOTIFICATION_URL=http://localhost:3000/api/v1/payments/paytr/callback
PAYTR_BASE_URL=https://www.paytr.com
```

### Açıklamalar:
- **PAYTR_MERCHANT_ID**: PayTR panelinden aldığınız "Mağaza No"
- **PAYTR_MERCHANT_KEY**: PayTR panelinden aldığınız "Mağaza Anahtarı"
- **PAYTR_MERCHANT_SALT**: PayTR panelinden aldığınız "Mağaza Gizli Anahtarı"
- **PAYTR_NOTIFICATION_URL**: PayTR panelinde ayarladığınız bildirim URL'i (opsiyonel, kod içinde de ayarlanabilir)
- **PAYTR_BASE_URL**: Genelde değiştirmenize gerek yok

### Test vs Canlı Ortam:

**Test Ortamı:**
```env
PAYTR_NOTIFICATION_URL=http://localhost:3000/api/v1/payments/paytr/callback
```

**Canlı Ortam:**
```env
PAYTR_NOTIFICATION_URL=https://yourdomain.com/api/v1/payments/paytr/callback
```

## 5. Test İşlemi Yapma

### Adımlar:
1. Backend sunucunuzu başlatın:
   ```bash
   npm run dev
   ```

2. Frontend'den bir ödeme işlemi başlatın

3. PayTR test kartı ile ödeme yapın:
   - **Kart Numarası**: `4355 0800 0000 0008`
   - **Son Kullanma**: Gelecek bir tarih (örn: `12/25`)
   - **CVV**: `000`
   - **Kart Sahibi**: Herhangi bir isim

4. PayTR panelinde kontrol edin:
   - Sol menüden **"İşlemler"** bölümüne gidin
   - Yaptığınız test işlemini görüntüleyin
   - İşlem durumunun **"Başarılı"** olduğunu kontrol edin

5. Bildirim kontrolü:
   - İşlem detayında **"Bildirim URL"** bölümüne bakın
   - **"OK"** yanıtı geldiğini kontrol edin
   - Eğer hata varsa, backend loglarını kontrol edin

## 6. Canlıya Geçiş

### Ön Kontroller:
- ✅ Test işlemleri başarıyla tamamlandı mı?
- ✅ Bildirim URL'den "OK" yanıtı geliyor mu?
- ✅ Backend'de ödeme kayıtları doğru oluşuyor mu?
- ✅ PayTR panelinde hesap onaylandı mı?

### Canlı Ortam Ayarları:
1. `.env` dosyasında:
   ```env
   NODE_ENV=production
   PAYTR_NOTIFICATION_URL=https://yourdomain.com/api/v1/payments/paytr/callback
   ```

2. PayTR panelinde:
   - Test modunu kapatın
   - Bildirim URL'ini canlı domain ile güncelleyin

3. Backend'i yeniden başlatın:
   ```bash
   npm run build
   npm start
   ```

## 7. Sorun Giderme

### Bildirim URL'den "OK" Yanıtı Gelmiyor

**Kontrol Edilecekler:**
1. Backend sunucusu çalışıyor mu?
2. Bildirim URL doğru mu? (PayTR panelinde kontrol edin)
3. Firewall veya güvenlik duvarı PayTR'ın isteklerini engelliyor mu?
4. Backend loglarında hata var mı? (`logs/error.log`)

**Çözüm:**
- Backend loglarını kontrol edin
- PayTR panelindeki bildirim URL'ini doğrulayın
- Sunucunuzun dışarıdan erişilebilir olduğundan emin olun

### Hash Doğrulama Hatası

**Hata:** `Invalid hash - notification rejected`

**Sebep:** Merchant Key veya Merchant Salt yanlış

**Çözüm:**
- PayTR panelinden bilgileri tekrar kopyalayın
- `.env` dosyasındaki değerleri kontrol edin
- Boşluk veya özel karakter olmadığından emin olun

### Token Alınamıyor

**Hata:** `PayTR token alınamadı`

**Kontrol Edilecekler:**
1. Merchant bilgileri doğru mu?
2. İnternet bağlantısı var mı?
3. PayTR API'sine erişilebiliyor mu?

**Çözüm:**
- `.env` dosyasındaki bilgileri kontrol edin
- Backend loglarını inceleyin
- PayTR panelinde hesap durumunu kontrol edin

## 8. Güvenlik Notları

⚠️ **ÖNEMLİ GÜVENLİK KURALLARI:**

1. **Merchant Bilgilerini Güvenli Tutun**
   - `.env` dosyasını asla commit etmeyin
   - `.gitignore` dosyasında `.env` olduğundan emin olun
   - Merchant bilgilerini kimseyle paylaşmayın

2. **HTTPS Kullanın**
   - Canlı ortamda mutlaka HTTPS kullanın
   - SSL sertifikası geçerli olmalı

3. **Hash Doğrulama**
   - Callback'te hash mutlaka doğrulanmalı
   - Hash doğrulama olmadan ödeme onaylanmamalı

4. **Idempotent İşlemler**
   - Aynı `merchant_oid` için birden fazla bildirim gelebilir
   - Sadece ilk bildirimi işleyin, diğerlerini "OK" ile yanıtlayın

## 9. PayTR Destek

PayTR ile ilgili sorularınız için:
- **E-posta**: destek@paytr.com
- **Telefon**: PayTR web sitesindeki iletişim bilgileri
- **Dokümantasyon**: https://dev.paytr.com/

## 10. Örnek Test Senaryosu

1. Frontend'den bir paket seçin
2. Araç bilgilerini girin
3. Ödeme adımına geçin
4. PayTR iframe açılacak
5. Test kartı ile ödeme yapın:
   - Kart: `4355 0800 0000 0008`
   - Tarih: `12/25`
   - CVV: `000`
6. Ödeme tamamlandıktan sonra:
   - PayTR panelinde işlemi kontrol edin
   - Backend'de ödeme kaydının oluştuğunu kontrol edin
   - Bildirim URL'den "OK" yanıtı geldiğini doğrulayın

## 11. Önemli Notlar

- PayTR asenkron çalışır: Ödeme sonucu callback'te gelir
- `merchant_ok_url` sadece kullanıcı yönlendirmesi içindir, sipariş onayı için kullanılmaz
- Bildirim URL mutlaka "OK" döndürmelidir, başka bir şey döndürülmemelidir
- Aynı sipariş için birden fazla bildirim gelebilir, idempotent işlem yapılmalıdır


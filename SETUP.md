# Backend Setup Guide

## Kurulum Adımları

### 1. Bağımlılıkları Yükleyin

```bash
npm install
```

### 2. MySQL Veritabanını Oluşturun

MySQL'e bağlanın ve veritabanını oluşturun:

```sql
CREATE DATABASE yol_asistan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Environment Değişkenlerini Ayarlayın

`.env` dosyasını oluşturun:

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin ve kendi ayarlarınızı girin:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=yol_asistan

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# CORS Configuration
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info

# PayTR Ödeme Entegrasyonu
# PayTR mağaza panelinden alacağınız bilgiler:
# 1. https://www.paytr.com adresinden mağaza hesabı oluşturun
# 2. Mağaza panelinde "Bilgi" veya "API Bilgileri" bölümünden:
#    - Mağaza No (Merchant ID)
#    - Mağaza Anahtarı (Merchant Key)
#    - Mağaza Gizli Anahtarı (Merchant Salt)
# 3. PayTR panelinde "Ayarlar" > "Bildirim URL" bölümüne:
#    - Test: http://localhost:3000/api/v1/payments/paytr/callback
#    - Canlı: https://yourdomain.com/api/v1/payments/paytr/callback
PAYTR_MERCHANT_ID=
PAYTR_MERCHANT_KEY=
PAYTR_MERCHANT_SALT=
PAYTR_NOTIFICATION_URL=http://localhost:3000/api/v1/payments/paytr/callback
PAYTR_BASE_URL=https://www.paytr.com
```

### 4. TypeORM Migration Çalıştırma

TypeORM otomatik olarak tabloları oluşturacaktır. İlk kez çalıştırdığınızda `synchronize: true` yapabilirsiniz (sadece development için).

`src/config/database.ts` dosyasında geçici olarak `synchronize: true` yapın:

```typescript
synchronize: process.env.NODE_ENV === 'development', // Development için true
```

### 5. İlk Super Admin Kullanıcısı Oluşturun

Sunucuyu başlattıktan sonra ilk super admin kullanıcısını oluşturmak için:

```bash
# POST isteği ile kayıt
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Super Admin",
    "email": "admin@yolasistan.com",
    "password": "Admin123!",
    "role": "SUPER_ADMIN"
  }'
```

### 6. Development Sunucusunu Başlatın

```bash
npm run dev
```

Sunucu `http://localhost:3000` adresinde çalışmaya başlayacak.

### 7. API Testi

Health check endpoint'i test edin:

```bash
curl http://localhost:3000/api/v1/health
```

## Örnek API Kullanımı

### 1. Giriş Yapma

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yolasistan.com",
    "password": "Admin123!"
  }'
```

Yanıt:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Super Admin",
      "email": "admin@yolasistan.com",
      "role": "SUPER_ADMIN"
    },
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here"
  }
}
```

### 2. Token ile İstek Yapma

Aldığınız `accessToken`'ı kullanarak:

```bash
curl -X GET http://localhost:3000/api/v1/agencies \
  -H "Authorization: Bearer your_access_token_here"
```

### 3. Bayi Oluşturma (SUPER_ADMIN)

```bash
curl -X POST http://localhost:3000/api/v1/agencies \
  -H "Authorization: Bearer your_access_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Sigorta Acentesi",
    "status": "ACTIVE"
  }'
```

## Production Deployment

### 1. Build

```bash
npm run build
```

### 2. Environment

Production `.env` dosyasını oluşturun:

- `NODE_ENV=production` olarak ayarlayın
- `synchronize: false` yapın (database.ts)
- Güçlü JWT secret kullanın
- CORS origin'i doğru şekilde ayarlayın

### 3. Start

```bash
npm start
```

## Önemli Notlar

- **Güvenlik**: Production'da mutlaka güçlü JWT secret kullanın
- **Database**: `synchronize: false` yapın ve migration kullanın
- **CORS**: Sadece izin verilen origin'leri ekleyin
- **Logs**: `logs/` klasörü otomatik oluşturulur
- **TypeScript**: Build öncesi tüm type hatalarını düzeltin

## Multi-Tenancy Test Senaryosu

### 1. SUPER_ADMIN Oluştur
- Tüm veriye erişebilir

### 2. Agency ve Branch Oluştur
```bash
# Agency oluştur
POST /api/v1/agencies
{
  "name": "ABC Sigorta"
}

# Branch oluştur
POST /api/v1/branches
{
  "agency_id": "agency_uuid",
  "name": "İstanbul Şubesi"
}
```

### 3. Farklı Rollerde Kullanıcılar Oluştur

```bash
# AGENCY_ADMIN
POST /api/v1/users
{
  "name": "Ahmet Yılmaz",
  "email": "ahmet@abc.com",
  "password": "Pass123!",
  "role": "AGENCY_ADMIN",
  "agency_id": "agency_uuid"
}

# BRANCH_ADMIN
POST /api/v1/users
{
  "name": "Mehmet Demir",
  "email": "mehmet@abc.com",
  "password": "Pass123!",
  "role": "BRANCH_ADMIN",
  "agency_id": "agency_uuid",
  "branch_id": "branch_uuid"
}

# BRANCH_USER
POST /api/v1/users
{
  "name": "Ayşe Kaya",
  "email": "ayse@abc.com",
  "password": "Pass123!",
  "role": "BRANCH_USER",
  "agency_id": "agency_uuid",
  "branch_id": "branch_uuid"
}
```

### 4. Her Kullanıcı ile Giriş Yapıp Veri Filtrelemeyi Test Et

Her kullanıcı sadece kendi yetki alanındaki verileri görebilmelidir.

## Sorun Giderme

### Port Kullanımda Hatası

```bash
# Port'u kontrol et
lsof -i :3000

# Başka port kullan
PORT=3001 npm run dev
```

### Database Bağlantı Hatası

- MySQL servisinin çalıştığından emin olun
- `.env` dosyasındaki bilgileri kontrol edin
- Database'in oluşturulduğunu doğrulayın

### TypeScript Hataları

```bash
# Type check
npm run build

# Lint check
npm run lint
```

## Yardım

Herhangi bir sorun yaşarsanız:
- Loglara bakın: `logs/error.log` ve `logs/combined.log`
- GitHub Issues: İlgili repository'de issue açın

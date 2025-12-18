# 🚀 Quick Start Guide

5 dakikada backend'inizi çalıştırın!

## 1️⃣ Bağımlılıkları Yükleyin

```bash
npm install
```

## 2️⃣ MySQL Veritabanı Oluşturun

```bash
# MySQL'e bağlanın
mysql -u root -p

# Veritabanı oluşturun
CREATE DATABASE yol_asistan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;
```

## 3️⃣ Environment Ayarlarını Yapın

```bash
# .env dosyası oluşturun
cp .env.example .env
```

`.env` dosyasını düzenleyin (zaten doğru ayarlı olmalı):

```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=yol_asistan
```

## 4️⃣ Test Verilerini Oluşturun

```bash
npm run seed
```

Bu komut:
- ✅ Tabloları otomatik oluşturur
- ✅ 5 bayi, 10 şube ekler
- ✅ 35+ kullanıcı oluşturur
- ✅ 5 sigorta paketi ve teminatlarını ekler
- ✅ 30 müşteri ve araç oluşturur
- ✅ 18 satış ve 14 ödeme kaydı ekler

## 5️⃣ Sunucuyu Başlatın

```bash
npm run dev
```

Sunucu `http://localhost:3000` adresinde çalışacak.

## 6️⃣ Test Edin!

### Health Check

```bash
curl http://localhost:3000/api/v1/health
```

### Login (Super Admin)

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
      "id": "...",
      "name": "Sistem Yöneticisi",
      "email": "admin@yolasistan.com",
      "role": "SUPER_ADMIN"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  },
  "message": "Login successful"
}
```

### Bayileri Listele

```bash
curl http://localhost:3000/api/v1/agencies \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🎯 Test Kullanıcıları

### Super Admin (Tüm veriye erişim)
```
Email: admin@yolasistan.com
Password: Admin123!
```

### Agency Admin (Sadece kendi bayisi)
```
Email: ahmet.yilmaz@anadolu.com
Password: Admin123!
```

### Branch Admin (Sadece kendi şubesi)
```
Email: fatma.ozturk@anadolu.com
Password: Admin123!
```

### Branch User (Sadece kendi verileri)
```
Email: can.yilmaz@anadolu.com
Password: User123!
```

## 📊 Test API Endpoint'leri

```bash
# Dashboard istatistikleri
GET /api/v1/stats/dashboard

# Müşterileri listele
GET /api/v1/customers

# Satışları listele
GET /api/v1/sales

# Paketleri listele
GET /api/v1/packages
```

## 🎉 Hazırsınız!

Backend tamamen çalışır durumda ve test için hazır!

### Sonraki Adımlar

1. **Postman/Thunder Client** ile API'leri detaylı test edin
2. **Farklı roller** ile giriş yapıp multi-tenancy'yi test edin
3. **İstatistik endpoint'lerini** kontrol edin
4. **Frontend** geliştirmeye başlayın

## 🆘 Sorun Giderme

### "Connection refused" hatası
```bash
# MySQL servisini başlatın
# macOS:
brew services start mysql

# Linux:
sudo systemctl start mysql
```

### "Database does not exist" hatası
```bash
# Veritabanını tekrar oluşturun
mysql -u root -p -e "CREATE DATABASE yol_asistan CHARACTER SET utf8mb4;"
```

### "Port 3000 already in use"
```bash
# Başka port kullanın
PORT=3001 npm run dev
```

## 📚 Daha Fazla Bilgi

- [README.md](README.md) - Genel dokümantasyon
- [SETUP.md](SETUP.md) - Detaylı kurulum rehberi
- [SEEDING.md](SEEDING.md) - Seed verileri hakkında detaylar

İyi geliştirmeler! 🚀

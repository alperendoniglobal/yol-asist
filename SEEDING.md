# Database Seeding Guide

Bu dokümanda veritabanını gerçekçi test verileriyle nasıl dolduracağınız anlatılmaktadır.

## 🌱 Seed Verileri Nelerdir?

Seed verileri, uygulamanızı test etmek ve geliştirmek için hazır test verileridir. Bu veriler şunları içerir:

### Oluşturulacak Veriler

- **5 Bayi (Agency)** - Farklı şehirlerde sigorta acenteleri
- **10 Şube (Branch)** - Her bayide 2 şube
- **35+ Kullanıcı (User)**
  - 1 SUPER_ADMIN
  - 5 AGENCY_ADMIN (her bayi için 1)
  - 10 BRANCH_ADMIN (her şube için 1)
  - 20 BRANCH_USER (her şube için 2)
- **5 Sigorta Paketi (Package)**
  - Özel araç paketleri (Plus ve Standart)
  - Ticari araç paketleri (Premium ve Standart)
  - Taksi paketi
  - Her paket için model yılına göre fiyatlar
  - Her paket için teminat listesi
- **30 Müşteri (Customer)** - Gerçekçi isim, TC, telefon ve adres bilgileri
- **30 Araç (Vehicle)** - Özel, ticari ve taksi araçları
- **~18 Satış (Sale)** - Araçların %60'ı için satış kaydı
- **~14 Ödeme (Payment)** - Satışların %80'i için ödeme kaydı

## 📋 Ön Gereksinimler

1. MySQL veritabanı çalışıyor olmalı
2. `yol_asistan` veritabanı oluşturulmuş olmalı
3. `.env` dosyası yapılandırılmış olmalı

```bash
# MySQL'e bağlan
mysql -u root -p

# Veritabanı oluştur
CREATE DATABASE yol_asistan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 🚀 Seed Verilerini Oluşturma

### Adım 1: .env Dosyasını Kontrol Edin

```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=yol_asistan
```

**ÖNEMLİ**: `NODE_ENV=development` olmalı ki tablolar otomatik oluşsun.

### Adım 2: Bağımlılıkları Yükleyin

```bash
npm install
```

### Adım 3: Seed Komutunu Çalıştırın

```bash
npm run seed
```

### Çıktı Örneği

```
🌱 Starting database seeding...

✓ Database connection established

📦 Seeding Agencies...
✓ Agency created: Anadolu Sigorta Acentesi
✓ Agency created: Güven Sigorta
✓ Agency created: Akdeniz Sigorta Hizmetleri
...

🏢 Seeding Branches...
✓ Branch created: Kadıköy Şubesi (Anadolu Sigorta Acentesi)
✓ Branch created: Beşiktaş Şubesi (Anadolu Sigorta Acentesi)
...

👥 Seeding Users...
✓ Super Admin created: admin@yolasistan.com
✓ Agency Admin created: ahmet.yilmaz@anadolu.com
...

✅ Database seeding completed successfully!

📊 Summary:
--------------------------------------------------
✓ Agencies: 5
✓ Branches: 10 (2 per agency)
✓ Users: 35+
✓ Packages: 5 (with prices and covers)
✓ Customers: 30
✓ Vehicles: 30
✓ Sales: ~18
✓ Payments: ~14
--------------------------------------------------

🔐 Login Credentials:
--------------------------------------------------
Super Admin:
  Email: admin@yolasistan.com
  Password: Admin123!

Agency Admin (example):
  Email: ahmet.yilmaz@anadolu.com
  Password: Admin123!

Branch Admin (example):
  Email: fatma.ozturk@anadolu.com
  Password: Admin123!

Branch User (example):
  Email: can.yilmaz@anadolu.com
  Password: User123!
--------------------------------------------------
```

## 🔐 Giriş Bilgileri

### Super Admin
```
Email: admin@yolasistan.com
Password: Admin123!
```
- Tüm verilere erişebilir
- Tüm işlemleri yapabilir

### Agency Admin (Bayi Yöneticisi)
```
Email: ahmet.yilmaz@anadolu.com (Anadolu Sigorta)
Email: mehmet.demir@guven.com (Güven Sigorta)
Email: ali.kaya@akdeniz.com (Akdeniz Sigorta)
Password: Admin123!
```
- Sadece kendi bayisini görebilir
- Kendi bayisinin şubelerini yönetebilir

### Branch Admin (Şube Yöneticisi)
```
Email: fatma.ozturk@anadolu.com (Kadıköy Şubesi)
Email: ayse.arslan@anadolu.com (Beşiktaş Şubesi)
Password: Admin123!
```
- Sadece kendi şubesini görebilir
- Şube kullanıcılarını yönetebilir

### Branch User (Şube Kullanıcısı)
```
Email: can.yilmaz@anadolu.com
Email: cem.demir@anadolu.com
Password: User123!
```
- Sadece kendi oluşturduğu verileri görebilir
- Müşteri, araç ve satış işlemleri yapabilir

## 🎯 Test Senaryoları

### 1. Multi-Tenancy Testi

```bash
# 1. Super Admin ile giriş yap
POST /api/v1/auth/login
{
  "email": "admin@yolasistan.com",
  "password": "Admin123!"
}

# 2. Tüm bayileri görebilmeli
GET /api/v1/agencies
# Sonuç: 5 bayi

# 3. Agency Admin ile giriş yap
POST /api/v1/auth/login
{
  "email": "ahmet.yilmaz@anadolu.com",
  "password": "Admin123!"
}

# 4. Sadece kendi bayisini görebilmeli
GET /api/v1/agencies
# Sonuç: 1 bayi (Anadolu Sigorta)

# 5. Branch User ile giriş yap
POST /api/v1/auth/login
{
  "email": "can.yilmaz@anadolu.com",
  "password": "User123!"
}

# 6. Sadece kendi müşterilerini görebilmeli
GET /api/v1/customers
# Sonuç: Sadece kendi oluşturduğu müşteriler
```

### 2. Satış ve Ödeme Testi

```bash
# Satışları listele
GET /api/v1/sales

# Belirli bir satışı görüntüle
GET /api/v1/sales/{sale_id}

# Satışa ait ödemeleri görüntüle
GET /api/v1/payments?sale_id={sale_id}

# Satış istatistikleri
GET /api/v1/sales/stats
```

### 3. İstatistik Testi

```bash
# Dashboard istatistikleri
GET /api/v1/stats/dashboard

# Satış istatistikleri
GET /api/v1/stats/sales

# Gelir istatistikleri
GET /api/v1/stats/revenue

# Müşteri istatistikleri
GET /api/v1/stats/customers
```

## 🔄 Seed Verilerini Yeniden Oluşturma

Eğer seed verilerini temizleyip tekrar oluşturmak isterseniz:

```bash
# 1. Veritabanını temizle (dikkatli!)
mysql -u root -p yol_asistan -e "DROP DATABASE yol_asistan;"
mysql -u root -p -e "CREATE DATABASE yol_asistan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Seed'i tekrar çalıştır
npm run seed
```

## 📌 Önemli Notlar

1. **İlk Çalıştırma**: Seed'i ilk defa çalıştırırken tablolar otomatik oluşturulur (synchronize: true)

2. **Tekrar Çalıştırma**: Seed'i tekrar çalıştırırsanız:
   - Var olan kayıtlar kontrol edilir
   - Duplicate kayıt oluşturulmaz
   - Sadece eksik kayıtlar eklenir

3. **Production**: Production ortamında:
   - `NODE_ENV=production` yapın
   - `synchronize: false` olmalı
   - Migration kullanın

4. **Şifreler**: Tüm şifreler bcrypt ile hashlenmiş olarak saklanır

5. **İlişkiler**: Tüm foreign key ilişkileri doğru şekilde kurulmuştur

## 🎲 Rastgele Veriler

Seed verileri gerçekçi test senaryoları için şu şekilde oluşturulur:

- **Satışlar**: Araçların %60'ı için rastgele satış
- **Ödemeler**: Satışların %80'i için ödeme
- **Ödeme Tipleri**: %60 Iyzico, %40 Bakiye
- **Ödeme Durumu**: %95 Tamamlandı, %5 Beklemede
- **Satış Tarihleri**: Son 6 ay içinde rastgele tarihler
- **Poliçe Süreleri**: 1 yıl

## 📞 Yardım

Sorun yaşarsanız:

1. MySQL servisinin çalıştığından emin olun
2. .env dosyasını kontrol edin
3. Veritabanının oluşturulduğunu doğrulayın
4. Hata loglarına bakın

## 🎉 Başarılı Seed Sonrası

Seed başarılı olduktan sonra:

1. Development sunucusunu başlatın: `npm run dev`
2. Postman/Thunder Client ile API'leri test edin
3. Farklı rol ile giriş yapıp multi-tenancy'yi test edin
4. İstatistik endpoint'lerini kontrol edin

Artık veritabanınız test için hazır! 🚀

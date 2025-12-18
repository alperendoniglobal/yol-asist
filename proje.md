🚀 Projenin Genel Amacı

Bu proje, multi-tenant (çok acenteli, çok şubeli) bayi yönetim sistemi olacak.

Temel işlevler:

Acenteler ve şubeler yönetimi

SUPER_ADMIN → tüm acenteleri ve şubeleri görür

AGENCY_ADMIN → sadece kendi acentesini ve şubelerini yönetir

BRANCH_ADMIN/USER → sadece kendi şubesini yönetir

Kullanıcı yönetimi

Kullanıcı rolleri: SUPER_ADMIN, AGENCY_ADMIN, BRANCH_ADMIN, BRANCH_USER

Her kullanıcı kendi yetkisi doğrultusunda veri görür ve işlem yapar

Müşteri ve araç yönetimi

Her müşteri ve aracı acente + şube bazlı izler

Araç bilgileri: marka, model, plaka, kullanım türü, model yılı

Paket yönetimi

Paketler satışa sunulur, fiyat ve teminat bilgileri içerir

Her paket bir veya birden fazla kullanıcı tipi için geçerli olabilir

Satış ve ödeme yönetimi

Satış kaydı oluşturulur

Ödeme tipleri: bakiyeden ödeme veya ödeme sağlayıcısı (iyzico)

Satış → komisyon → ödeme ilişkisi yönetilir

Komisyon ve muhasebe yönetimi

Komisyon talep ve ödeme geçmişi tutulur

Raporlama için istatistikler üretilir

Destek talep yönetimi

Ticket sistemi ile kullanıcılar destek talebi oluşturabilir

Mesajlaşma, dosya ekleme ve durum takibi yapılır

İstatistik ve raporlama

Acenteler ve SUPER_ADMIN için satış, paket, şube bazlı raporlar

Cron job veya query caching ile performanslı veri sunumu

🧩 Controller ve Service Yapısı

Controller’lar ve Service’lar ayrık mantıkta çalışacak:

Controller

HTTP endpoint’lerini tanımlar

Gelen request’i validate eder (middleware ile)

Service metodlarını çağırır

Response döner

Service

İş mantığını içerir

Repository (TypeORM) üzerinden DB işlemlerini yapar

CRUD, filtreleme, hesaplama (komisyon, fiyat) gibi işlemler buraya yazılır

🔄 Örnek Akış (Paket Satışı)

Kullanıcı (BRANCH_USER) → PackageController.getAll() çağırır

Controller → PackageService.getAll() çağırır

Service → DB’den paketleri filtreleyip getirir (tenant bazlı)

Controller → JSON ile döner

Kullanıcı paket seçer → SaleController.create()

Service → Yeni satış kaydı oluşturur, commission hesaplar, payment kaydeder

Response → satış başarı mesajı ve ID

📝 Controller / Service Sorumlulukları Özet Tablosu
Modül	Controller	Service
Packages	CRUD paketler, fiyat ve teminatları göster	Paket verilerini DB’den al, filtrele, oluştur, güncelle, sil
Sales	Satış oluştur, listele, detay, iptal, yenileme	Satış DB işlemleri, komisyon hesaplama, istatistikler
Users	Kullanıcı oluştur, düzenle, sil, listele	Kullanıcı işlemleri, role bazlı izinler
Customers	Müşteri CRUD	Tenant bazlı filtreleme
Vehicles	Araç CRUD	Araç bazlı filtreleme, model/yıl doğrulama
Payments	Ödeme oluştur, listele	Ödeme sağlayıcı entegrasyonu, bakiye yönetimi
Commission	Komisyon talep et, geçmiş	Komisyon hesaplama, ödeme geçmişi
Support	Ticket CRUD, mesaj ekle	Ticket yönetimi, dosya ekleme, status update
Statistics	Raporlar, grafikler	Satış, paket, şube bazlı query ve aggregation
🔐 Permission / Middleware Mantığı

authMiddleware: JWT doğrulama + user attach

roleMiddleware(roles): kullanıcının role check

tenantMiddleware: tenant filtreleme (agency_id + branch_id + created_by)

validationMiddleware: request body validation

İstersen bir sonraki adımda sana bu servis ve controller’ların tüm methodlarının hangi işlemleri yapacağını tek tek açıklayan bir “action map” tablosu hazırlayabilirim.
Bu tabloya göre Cursor veya senin ekip her methodu kolayca doldurabilir.

Bunu hazırlayayım mı?
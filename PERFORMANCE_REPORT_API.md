# SUPER_AGENCY_ADMIN Performans Raporu API

## Endpoint

```
GET /api/v1/stats/super-agency-admin/performance
```

## Yetkilendirme

- **SUPER_ADMIN**: Tüm verileri görebilir
- **SUPER_AGENCY_ADMIN**: Sadece yönettiği agency'lerin verilerini görebilir

## Açıklama

Bu API, SUPER_AGENCY_ADMIN rolündeki kullanıcıların yönettiği agency'ler, branch'ler ve user'ların satış performanslarını detaylı bir şekilde döndürür.

## Örnek Çıktı

```json
{
  "success": true,
  "message": "Performance report retrieved successfully",
  "data": {
    "agencies": [
      {
        "id": "agency-uuid-1",
        "name": "Anadolu Sigorta",
        "tax_number": "1234567890",
        "address": "İstanbul, Türkiye",
        "phone": "+90 212 123 45 67",
        "email": "info@anadolusigorta.com",
        "status": "ACTIVE",
        "commission_rate": 25.00,
        "balance": 50000.00,
        "performance": {
          "totalSales": 150,
          "totalRevenue": 450000.00,
          "totalCommission": 112500.00
        },
        "branches": [
          {
            "id": "branch-uuid-1",
            "name": "Kadıköy Şubesi",
            "address": "Kadıköy, İstanbul",
            "phone": "+90 216 123 45 67",
            "status": "ACTIVE",
            "commission_rate": 15.00,
            "balance": 20000.00,
            "performance": {
              "totalSales": 80,
              "totalRevenue": 240000.00,
              "totalCommission": 36000.00
            },
            "users": [
              {
                "id": "user-uuid-1",
                "name": "Ahmet",
                "surname": "Yılmaz",
                "email": "ahmet.yilmaz@anadolusigorta.com",
                "phone": "+90 555 123 45 67",
                "role": "BRANCH_USER",
                "status": "ACTIVE",
                "performance": {
                  "totalSales": 45,
                  "totalRevenue": 135000.00,
                  "totalCommission": 20250.00
                }
              },
              {
                "id": "user-uuid-2",
                "name": "Fatma",
                "surname": "Öztürk",
                "email": "fatma.ozturk@anadolusigorta.com",
                "phone": "+90 555 234 56 78",
                "role": "BRANCH_ADMIN",
                "status": "ACTIVE",
                "performance": {
                  "totalSales": 35,
                  "totalRevenue": 105000.00,
                  "totalCommission": 15750.00
                }
              }
            ]
          },
          {
            "id": "branch-uuid-2",
            "name": "Beşiktaş Şubesi",
            "address": "Beşiktaş, İstanbul",
            "phone": "+90 212 234 56 78",
            "status": "ACTIVE",
            "commission_rate": 15.00,
            "balance": 15000.00,
            "performance": {
              "totalSales": 70,
              "totalRevenue": 210000.00,
              "totalCommission": 31500.00
            },
            "users": [
              {
                "id": "user-uuid-3",
                "name": "Mehmet",
                "surname": "Demir",
                "email": "mehmet.demir@anadolusigorta.com",
                "phone": "+90 555 345 67 89",
                "role": "BRANCH_USER",
                "status": "ACTIVE",
                "performance": {
                  "totalSales": 50,
                  "totalRevenue": 150000.00,
                  "totalCommission": 22500.00
                }
              },
              {
                "id": "user-uuid-4",
                "name": "Ayşe",
                "surname": "Kaya",
                "email": "ayse.kaya@anadolusigorta.com",
                "phone": "+90 555 456 78 90",
                "role": "BRANCH_USER",
                "status": "ACTIVE",
                "performance": {
                  "totalSales": 20,
                  "totalRevenue": 60000.00,
                  "totalCommission": 9000.00
                }
              }
            ]
          }
        ],
        "agencyUsers": [
          {
            "id": "user-uuid-5",
            "name": "Can",
            "surname": "Yılmaz",
            "email": "can.yilmaz@anadolusigorta.com",
            "phone": "+90 555 567 89 01",
            "role": "AGENCY_ADMIN",
            "status": "ACTIVE",
            "performance": {
              "totalSales": 0,
              "totalRevenue": 0.00,
              "totalCommission": 0.00
            }
          }
        ]
      },
      {
        "id": "agency-uuid-2",
        "name": "Ege Sigorta",
        "tax_number": "0987654321",
        "address": "İzmir, Türkiye",
        "phone": "+90 232 123 45 67",
        "email": "info@egesigorta.com",
        "status": "ACTIVE",
        "commission_rate": 20.00,
        "balance": 30000.00,
        "performance": {
          "totalSales": 100,
          "totalRevenue": 300000.00,
          "totalCommission": 60000.00
        },
        "branches": [
          {
            "id": "branch-uuid-3",
            "name": "Konak Şubesi",
            "address": "Konak, İzmir",
            "phone": "+90 232 234 56 78",
            "status": "ACTIVE",
            "commission_rate": 12.00,
            "balance": 10000.00,
            "performance": {
              "totalSales": 100,
              "totalRevenue": 300000.00,
              "totalCommission": 36000.00
            },
            "users": [
              {
                "id": "user-uuid-6",
                "name": "Ali",
                "surname": "Veli",
                "email": "ali.veli@egesigorta.com",
                "phone": "+90 555 678 90 12",
                "role": "BRANCH_USER",
                "status": "ACTIVE",
                "performance": {
                  "totalSales": 100,
                  "totalRevenue": 300000.00,
                  "totalCommission": 36000.00
                }
              }
            ]
          }
        ],
        "agencyUsers": []
      }
    ],
    "summary": {
      "totalAgencies": 2,
      "totalBranches": 3,
      "totalUsers": 6,
      "totalSales": 250,
      "totalRevenue": 750000.00,
      "totalCommission": 172500.00
    }
  }
}
```

## Veri Yapısı

### Agency (Acente)
- **id**: Acente UUID
- **name**: Acente adı
- **tax_number**: Vergi numarası
- **address**: Adres
- **phone**: Telefon
- **email**: E-posta
- **status**: Durum (ACTIVE/INACTIVE)
- **commission_rate**: Komisyon oranı (%)
- **balance**: Bakiye (TL)
- **performance**: Acente bazlı performans
  - **totalSales**: Toplam satış sayısı
  - **totalRevenue**: Toplam gelir (TL)
  - **totalCommission**: Toplam komisyon (TL)
- **branches**: Şube listesi
- **agencyUsers**: Branch'i olmayan merkez çalışanları

### Branch (Şube)
- **id**: Şube UUID
- **name**: Şube adı
- **address**: Adres
- **phone**: Telefon
- **status**: Durum (ACTIVE/INACTIVE)
- **commission_rate**: Komisyon oranı (%)
- **balance**: Bakiye (TL)
- **performance**: Şube bazlı performans
  - **totalSales**: Toplam satış sayısı
  - **totalRevenue**: Toplam gelir (TL)
  - **totalCommission**: Toplam komisyon (TL)
- **users**: Şube çalışanları listesi

### User (Kullanıcı)
- **id**: Kullanıcı UUID
- **name**: Ad
- **surname**: Soyad
- **email**: E-posta
- **phone**: Telefon
- **role**: Rol (BRANCH_USER, BRANCH_ADMIN, AGENCY_ADMIN, vb.)
- **status**: Durum (ACTIVE/INACTIVE)
- **performance**: Kullanıcı bazlı performans
  - **totalSales**: Toplam satış sayısı
  - **totalRevenue**: Toplam gelir (TL)
  - **totalCommission**: Toplam komisyon (TL)

### Summary (Özet)
- **totalAgencies**: Toplam agency sayısı
- **totalBranches**: Toplam branch sayısı
- **totalUsers**: Toplam kullanıcı sayısı
- **totalSales**: Toplam satış sayısı
- **totalRevenue**: Toplam gelir (TL)
- **totalCommission**: Toplam komisyon (TL)

## Kullanım Senaryoları

1. **Acente Bazlı Performans**: Her agency'nin toplam satış, gelir ve komisyon bilgileri
2. **Şube Bazlı Performans**: Her branch'in toplam satış, gelir ve komisyon bilgileri
3. **Kullanıcı Bazlı Performans**: Her user'ın yaptığı satış sayısı, gelir ve komisyon bilgileri
4. **Özet İstatistikler**: Tüm yönetilen agency'lerin toplam performans özeti

## Notlar

- Sadece silinmemiş (`is_deleted: false`) ve aktif kullanıcılar listelenir
- Satış performansı, `Sale` tablosundaki `user_id` kolonuna göre hesaplanır
- Komisyon hesaplamaları, satış kayıtlarındaki `commission` kolonundan alınır
- Branch'i olmayan kullanıcılar (merkez çalışanları) `agencyUsers` array'inde gösterilir
- Eğer SUPER_AGENCY_ADMIN hiç agency yönetmiyorsa, boş bir array ve sıfır özet döner

# Car Brands & Car Models API Kullanımı

Bu dokümanda **yol-asist** projesindeki araç markası (car brand) ve araç modeli (car model) API’leri anlatılmaktadır. **Marka/model ekleme, güncelleme ve silme sadece SUPER_ADMIN** rolü ile yapılabilir.

---

## Base URL

- `http://localhost:3000/api/v1` veya `https://<domain>/api/v1`

---

## 1. Public API (Authentication gerekmez)

Form / satın alma sayfalarında marka–model seçimi için kullanılır.

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| GET | `/api/v1/public/car-brands` | Tüm araç markalarını listeler (alfabetik). |
| GET | `/api/v1/public/car-models/:brandId` | Belirtilen marka ID’sine ait modelleri listeler. |

**Örnek:**

```bash
curl -X GET "http://localhost:3000/api/v1/public/car-brands"
curl -X GET "http://localhost:3000/api/v1/public/car-models/3"
```

---

## 2. Authenticated API (JWT gerekir)

Panelde listeleme ve tek kayıt için. Tüm giriş yapmış kullanıcılar (yetkili roller) kullanabilir.

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| GET | `/api/v1/car-brands` | Tüm markaları listeler (ilişkili `models` ile). |
| GET | `/api/v1/car-brands/:id` | ID ile tek marka getirir. |
| GET | `/api/v1/car-models` | Tüm modelleri listeler. Opsiyonel: `?brandId=3` |
| GET | `/api/v1/car-models/brand/:brandId` | Belirtilen markanın modellerini getirir. |
| GET | `/api/v1/car-models/:id` | ID ile tek model getirir. |

**Örnek:**

```bash
curl -X GET "http://localhost:3000/api/v1/car-brands" \
  -H "Authorization: Bearer <JWT_TOKEN>"

curl -X GET "http://localhost:3000/api/v1/car-models?brandId=3" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## 3. Super Admin API (Sadece SUPER_ADMIN)

**Marka ve model ekleme, güncelleme ve silme** işlemleri yalnızca **SUPER_ADMIN** rolüne sahip kullanıcılar tarafından yapılabilir. Diğer roller 403 Forbidden alır.

### 3.1 Car Brands (Marka) – POST, PUT, DELETE

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| POST | `/api/v1/car-brands` | Yeni marka oluşturur. |
| PUT | `/api/v1/car-brands/:id` | Marka günceller. |
| DELETE | `/api/v1/car-brands/:id` | Marka siler (hiç araç bu markayı kullanmıyorsa). |

#### POST /api/v1/car-brands – Yeni marka

**Body (JSON):**

```json
{
  "name": "YENİ MARKA"
}
```

- **name** (zorunlu): Marka adı.
- **id** (opsiyonel): Veritabanı ID. Verilmezse otomatik olarak `MAX(id)+1` atanır. Verirseniz çakışma yoksa o id kullanılır.

**Örnek:**

```bash
curl -X POST "http://localhost:3000/api/v1/car-brands" \
  -H "Authorization: Bearer <SUPER_ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name": "YENİ MARKA"}'
```

**Başarı (201):**

```json
{
  "success": true,
  "data": { "id": 999, "name": "YENİ MARKA", "created_at": "...", "updated_at": "..." },
  "message": "Car brand created successfully"
}
```

**Hata (400):** Marka adı boş.  
**Hata (409):** Verilen id zaten kullanılıyor.

---

#### PUT /api/v1/car-brands/:id – Marka güncelle

**Body (JSON):**

```json
{
  "name": "GÜNCELLENMİŞ MARKA ADI"
}
```

**Örnek:**

```bash
curl -X PUT "http://localhost:3000/api/v1/car-brands/999" \
  -H "Authorization: Bearer <SUPER_ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name": "GÜNCELLENMİŞ MARKA ADI"}'
```

**Hata (404):** Marka bulunamadı.  
**Hata (400):** name boş.

---

#### DELETE /api/v1/car-brands/:id – Marka sil

Bu markayı kullanan en az bir **araç (vehicle)** kaydı varsa silme yapılmaz.

**Örnek:**

```bash
curl -X DELETE "http://localhost:3000/api/v1/car-brands/999" \
  -H "Authorization: Bearer <SUPER_ADMIN_JWT>"
```

**Başarı (200):**

```json
{
  "success": true,
  "data": { "deleted": true, "id": 999 },
  "message": "Car brand deleted successfully"
}
```

**Hata (404):** Marka bulunamadı.  
**Hata (409):** Bu marka X araç kaydında kullanılıyor; önce araçların markasını değiştirin.

---

### 3.2 Car Models (Model) – POST, PUT, DELETE

| Metot | Endpoint | Açıklama |
|-------|----------|----------|
| POST | `/api/v1/car-models` | Yeni model oluşturur. |
| PUT | `/api/v1/car-models/:id` | Model günceller. |
| DELETE | `/api/v1/car-models/:id` | Model siler (hiç araç bu modeli kullanmıyorsa). |

#### POST /api/v1/car-models – Yeni model

**Body (JSON):**

```json
{
  "brand_id": 3,
  "name": "MODEL ADI",
  "value": "opsiyonel_deger",
  "id": 9000
}
```

- **brand_id** (zorunlu): Marka ID (cars_brands’ta mevcut olmalı).
- **name** (zorunlu): Model adı.
- **value** (opsiyonel): Ek alan.
- **id** (opsiyonel): Veritabanı ID. Verilmezse `MAX(id)+1` atanır.

**Örnek:**

```bash
curl -X POST "http://localhost:3000/api/v1/car-models" \
  -H "Authorization: Bearer <SUPER_ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"brand_id": 3, "name": "YENİ MODEL"}'
```

**Hata (400):** name veya brand_id eksik.  
**Hata (404):** Belirtilen marka bulunamadı.  
**Hata (409):** Verilen id zaten kullanılıyor.

---

#### PUT /api/v1/car-models/:id – Model güncelle

**Body (JSON):** Gönderilen alanlar güncellenir.

```json
{
  "brand_id": 3,
  "name": "Güncel model adı",
  "value": "opsiyonel"
}
```

**Örnek:**

```bash
curl -X PUT "http://localhost:3000/api/v1/car-models/9000" \
  -H "Authorization: Bearer <SUPER_ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Güncel model adı"}'
```

**Hata (404):** Model veya (brand_id değiştiriliyorsa) marka bulunamadı.  
**Hata (400):** name boş (name gönderildiyse).

---

#### DELETE /api/v1/car-models/:id – Model sil

Bu modeli kullanan en az bir **araç (vehicle)** kaydı varsa silme yapılmaz.

**Örnek:**

```bash
curl -X DELETE "http://localhost:3000/api/v1/car-models/9000" \
  -H "Authorization: Bearer <SUPER_ADMIN_JWT>"
```

**Hata (409):** Bu model X araç kaydında kullanılıyor.

---

## 4. Yetki özeti

| İşlem | Public | Auth (herhangi rol) | SUPER_ADMIN |
|-------|--------|----------------------|-------------|
| Marka listele | GET public/car-brands | GET car-brands | ✓ |
| Marka getir (id) | — | GET car-brands/:id | ✓ |
| **Marka oluştur** | — | — | **POST car-brands** |
| **Marka güncelle** | — | — | **PUT car-brands/:id** |
| **Marka sil** | — | — | **DELETE car-brands/:id** |
| Model listele | GET public/car-models/:brandId | GET car-models | ✓ |
| Model getir (id) | — | GET car-models/:id | ✓ |
| **Model oluştur** | — | — | **POST car-models** |
| **Model güncelle** | — | — | **PUT car-models/:id** |
| **Model sil** | — | — | **DELETE car-models/:id** |

SUPER_ADMIN dışındaki bir kullanıcı POST/PUT/DELETE denerse **403 Forbidden** ve mesaj: `You do not have permission to access this resource`.

---

## 5. Veritabanına toplu veri (Seed / Scrape)

- **Seed:** `npm run seed` → `00-car-brands.seed.ts`, `01-car-models.seed.ts` ile ilk veri.
- **Scrape:** `npm run scrape:car-models` → Harici kaynaktan marka/model çekilip DB’ye yazılır.

---

## 6. Tablolar

- **cars_brands:** id, name, created_at, updated_at  
- **cars_models:** id, brand_id, name, value, created_at, updated_at  

Araç (vehicle) kayıtları `brand_id` ve `model_id` ile bu tablolara bağlıdır. Bir marka/model en az bir araçta kullanılıyorsa silinemez (409).

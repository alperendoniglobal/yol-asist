# Komisyon Hesaplama Hatası — Tespit ve Düzeltme Raporu

**Tarih:** 03.09.2026
**Durum:** Kod düzeltildi, geçmiş veriler düzeltildi, doğrulandı.

---

## 1. Sorun neydi

Sistemde acente ve brokerlara ödenen satış komisyonları, paket fiyatının içindeki **KDV (%20) düşülmeden** hesaplanıyordu.

**Doğru kural:** Paket fiyatları KDV dahildir. Komisyon hesaplanmadan önce fiyattan KDV çıkarılır (net fiyat = fiyat ÷ 1,20), oran bu net tutara uygulanır.

**Örnek — 1.000 ₺'lik paket, acente oranı %30, broker toplam oranı %40:**

| | Olması gereken | Sistemin yaptığı (hatalı) |
|---|---|---|
| Net fiyat (1.000 ÷ 1,20) | 833,33 ₺ | *(hiç hesaplanmadı)* |
| Acenteye ödenecek | **250 ₺** | **300 ₺** |
| Brokere ödenecek | **83,33 ₺** | **100 ₺** |

Sonuç: her satışta tanımlı orandan **~%20 fazla** komisyon ödeniyordu.

---

## 2. Kök neden (kod)

`src/services/SaleService.ts` içindeki komisyon hesaplama fonksiyonları (`calculateCommission`, `calculateDistributedCommission`), satış fiyatından KDV düşmeden doğrudan `price × oran / 100` işlemi yapıyordu. Kodun kendi yorum satırı bunu itiraf ediyordu: *"KDV dahil satış fiyatı üzerinden hesaplanır."*

Sistemin başka üç yerinde (iade tutarı hesaplama, seed/test verisi üretimi, özel satış scripti) KDV zaten doğru düşülüyordu — yani doğru kural biliniyordu, sadece asıl satış kaydını oluşturan koda hiç işlenmemişti.

Ayrıca `utils/commissionDisplay.ts` (Dashboard'daki bilgilendirme mantığı), KDV **düşülerek** doğru hesaplanan nadir kayıtları "anomali" olarak işaretliyordu — mantık tersine dönmüştü.

---

## 3. Yapılan kod düzeltmeleri

| Dosya | Değişiklik |
|---|---|
| `src/utils/commission.ts` *(yeni)* | Merkezi KDV sabiti ve `toNetPrice`/`calculateCommissionAmount` yardımcı fonksiyonları |
| `src/services/SaleService.ts` | `calculateCommission` ve `calculateDistributedCommission` artık `price / 1.20` (net fiyat) üzerinden hesaplıyor. `create()` ve `update()` artık dışarıdan (frontend, script) gelen komisyon değerlerine **hiç güvenmiyor** — her zaman backend'de yeniden hesaplanıyor. |
| `src/utils/commissionDisplay.ts` | Anomali tespiti tersine çevrildi: artık KDV **dahil** (eski, hatalı) formülle eşleşen kayıtlar işaretleniyor. `displayTotal`, satışın **kendi kayıtlı** komisyon kolonundan okunuyor — tablodaki "şimdiki" orandan yeniden hesaplama yapılmıyor (çünkü oran zaman içinde değişebilir, satıştaki kayıtlı değer satış anındaki gerçek oranı temsil eder). |
| `src/services/BranchService.ts` | Acente detay API'si artık sadece acentenin **kendi payını** (`branch_commission`) gösteriyor — daha önce broker payını da içeren toplam (`commission`) gösteriliyordu. |
| `src/services/AgencyService.ts` | Aynı düzeltme broker tarafı için (`agency_commission`). |
| `src/middlewares/tenantMiddleware.ts` | Şube yöneticisi filtresi artık sadece `branch_id`'ye bakıyor, `agency_id`'yi zorunlu koşmuyor. **Sebep:** bir şube başka bir brokere devredildiğinde geçmiş satışların `agency_id`'si güncellenmiyor (satış anındaki brokeri donduruyor); eski filtre bu satışları kullanıcının kendi panelinden gizliyordu. |
| `asist-front/src/pages/sales/NewSale.tsx` | Satış ekranındaki komisyon önizlemesi de KDV kuralına göre düzeltildi (kozmetik — backend zaten kendi hesaplıyordu, ama önizleme yanıltıcıydı) |
| `asist-front/src/pages/dashboard/Dashboard.tsx` | "Kazanılan (Toplam)" kartı artık doğru (`totalEarnedDisplay`) alanı kullanıyor; acente/broker/şube rolleri kendi panelinde **negatif bakiye görmüyor** (0'da sınırlı) — SUPER_ADMIN gerçek rakamı görmeye devam ediyor. |
| `asist-front/src/pages/commissions/Commissions.tsx` | "Toplam Kazanılan" sütunu ve sıralaması aynı şekilde düzeltildi; negatif bakiye gösterimi SUPER_ADMIN dışında sınırlandı. |

---

## 4. Geçmiş veri düzeltmesi

Sistem taraması: **159 şubeli satıştan 69'unda** (branch payı) ve **71'inde** (broker payı) eski, KDV düşülmemiş formül tespit edildi. Bu satışlar **2 Eylül 2026'ya kadar (yani düzeltme anına kadar) kesintisiz** devam ediyordu.

**Uygulanan düzeltme:** Her etkilenen satışın kayıtlı `branch_commission`/`agency_commission` değeri, **satış anındaki kendi oranı korunarak** (`branches.commission_rate`'in şimdiki değeri kullanılmadan — çünkü oranlar zaman içinde değişmiş olabilir), sadece KDV adımı eklenerek yeniden hesaplandı: `yeni değer = eski değer ÷ 1,20`. Ardından `commission` (toplam) kolonu, `branch_commission + agency_commission` ile tutarlı hale getirildi.

**Sonuç:**
- Şube (acente) payında toplam **₺4.661,17** fazla ödeme tespit edilip düzeltildi.
- Broker payında toplam **₺1.950,83** fazla ödeme tespit edilip düzeltildi.

**Ayrıca fark edilen ayrı bir sorun:** Bazı satışlarda (5 tanesi) hem yeni hem eski formülle uyuşmayan kayıtlar bulundu — sebebi, o satışların yapıldığı tarihte acente/broker komisyon oranının **şimdikinden farklı** olmasıydı (oranlar sonradan değiştirilmiş). Bu satışlara **dokunulmadı** — oranları hâlâ satış anındaki gerçek değeri doğru şekilde taşıyorlar, sadece KDV uygulanmamış eski formülle eşleşenler düzeltildi.

---

## 5. Bakiyelerin yeniden hesaplanması

Broker/acente `balance` (bakiye) alanı, satışlardan canlı hesaplanmıyor — 13.08.2026'da bir kerelik çalıştırılmış bir "reconcile" script'inin ürettiği, o tarihten sonra satış/ödeme oldukça artırılıp azaltılan bir sayaç. Bu script, **KDV hatası düzeltilmeden önceki** kayıtlı komisyon değerlerini esas almıştı — yani bakiye de kirliydi.

**Yapılan:** Tüm 75 acente ve 14 broker için `balance` kolonu, düzeltilmiş kayıtlı komisyon kolonlarından yeniden hesaplandı:

```
bakiye = Σ(kayıtlı komisyon, bakiyeyle ödenen satışlar hariç) − Σ(fiilen ödenmiş komisyon talepleri)
```

**Sonuç doğrulaması:** Sistemdeki tüm 22 aktif broker/acente satırında `kazanılan − ödenen − bakiye = 0,00 ₺` — matematiksel tutarlılık sağlandı (önceden bazı satırlarda "16 bin kazanmış, 17 bin daha ödenecek" gibi çelişkiler vardı).

**Not:** Düzeltme sonrası bazı acente/broker (ACENTE20, SAKİNE ŞİMŞİR, CAN ATÇEKEN, EBRAR ARSLAN, FURKAN ORTAACAR, VEDAT AKBAŞ, sakarya str ismail yolacık, AYTEK SİGORTA, SV SİGORTA) **negatif bakiyeli** çıktı — yani geçmişte, eski hatalı hesapla, hak edişlerinden **fazla ödeme almışlar**. Bu rakamlar gerçeği yansıtıyor, gizlenmedi (sadece SUPER_ADMIN dışındaki kullanıcı panellerinde 0 olarak gösteriliyor, DB'deki gerçek değer değişmedi).

---

## 6. Bundan sonrası için alınan önlemler

- `SaleService.create()` ve `update()` artık **hiçbir zaman** dışarıdan gelen komisyon değerine güvenmiyor — price, branch_id veya agency_id her değiştiğinde komisyon backend'de otomatik yeniden hesaplanıyor.
- Tek doğru kaynak: `SaleService.calculateDistributedCommission()`. Bu fonksiyonun dışında hiçbir yerde manuel komisyon hesabı yok.

**Dokunulmadı / kapsam dışı bırakıldı:**
- PayTR ödeme tamamlama akışı (`PaymentService.ts`) — kullanıcı isteğiyle bu turda incelenmedi. **Bilinmesi gereken:** DB'de tamamlanmamış (PENDING) **42 adet** eski PayTR kaydı, hâlâ eski (KDV'siz) formülle hesaplanmış `commission` değeri taşıyor. Bu ödemeler tamamlanırsa, o satışlar eski hatalı komisyonla oluşacak. Ayrı bir zamanda ele alınmalı.

---

## 7. Test ve doğrulama

- `calculateDistributedCommission` fonksiyonu 4 senaryoda (şubeli satış, sadece broker, ne şube ne broker, farklı tutarlar) test edildi — hepsi beklenen KDV-hariç sonucu verdi.
- Gerçek veriyle: 1.000 ₺ KDV dahil satışta artık acente 250 ₺, broker 83,33 ₺ alıyor (doğrulandı).
- Tüm 22 aktif broker/acente satırında `kazanılan − ödenen = bakiye` eşitliği canlı API üzerinden doğrulandı (fark: 0,00 ₺, istisnasız).
- Backend ve frontend `tsc` ile hatasız derleniyor.

---

## 8. Broker/Acente bazlı özet rapor

Ayrıntılı, sıralanabilir tablo halinde bir rapor yayınlandı:
**https://claude.ai/code/artifact/819681f5-ae9b-4f3a-86cf-d2487e9df25e**

(8 aktif broker, 16 aktif acente; satış adedi, ciro, kazanılan, ödenen, bakiye kırılımıyla.)

---

## 9. Önerilen sonraki adımlar

1. **PayTR'deki 42 bekleyen kaydın** komisyon değerlerinin gözden geçirilmesi (bkz. Bölüm 6).
2. **Negatif bakiyeli acente/brokerler** (₺2.108,66 toplam fazla ödeme) için bir mahsup/bildirim politikası belirlenmesi.
3. Komisyon oranı değiştirildiğinde, geçmiş satışların hangi oranla hesaplandığının ayrıca kayıt altına alınması (şu an sadece hesaplanmış tutar saklanıyor, oranın kendisi değil) — ileride benzer bir karışıklığı önler.

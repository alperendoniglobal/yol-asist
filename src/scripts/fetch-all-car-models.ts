import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { CarBrand } from '../entities/CarBrand';
import { CarModel } from '../entities/CarModel';
import axios from 'axios';

/**
 * Marka ve Model Script - Yeniden Yazılmış Versiyon
 * Verilen JSON markalarını kullanarak API'den modelleri çeker ve veritabanına kaydeder
 * - Retry mekanizması ile güvenilir API çağrıları
 * - Detaylı logging ile sorun tespiti
 * - Farklı response formatlarını handle eder
 */

// API Configuration
const API_URL = 'https://open.techdestekasist.com/bayi/ajax/MarkaModel';
const COOKIE_STRING = '_ga=GA1.1.1748018400.1764179755; ARRAffinity1=705e227ad8a19aa24032b76632992116929e2b2b8e349cba9cf4d92887f73c88; .AspNetCore.Antiforgery.geKjHJPc-IM=CfDJ8BBA3arab1VIljiAtyr-lkfZ7NO4uu2aRxtgIbzbN5GNHrRJsm0fGfCF_mgbwybiIeQCvOZxz_E3qf86vLO17B3TXtEQjB_Ehlx3YUDtX_AEzCKzmUGGU6FqIkw-ng50piqKa6MsYCQlnOlUgLOQPOQ; OpenAsistansSesion=CfDJ8BBA3arab1VIljiAtyr-lke7SrShFAQ087ryP2FGUdNmFGh80eSXJL8XVAInOdrDNSUvHn0h0P05X1Pvk3evzsEf0dDbZkO6K4t7sNeW5c-NaDWSalAAxlMcH93KHi6UxOltIqHXTOwPOiFdnWZqCHkJh3pJi4Dd1DwgRz7FqxLwTE1oN6x24FtrwYWmG7M63Uzg9E8yIU1CgLUMZauZhYnPljhIfdu4z5OgpN89A7GvGBo47mUXYLBLPalkdw38xjUbMt4QoiVWVwXd679LP38_-6sim4tRyxkTp2of_rFTcXWLkWbl-oVS-4ZxJcvpcPuyr28-8IL8fWF_KOvcbMG8y44uRbK9no1-TDWecgcqK4NQ4ItRrhmlgeq9-kjc1e8cw0jWEleQb_JHr8R02r6UnkpglFZ9hFYeyPuTkdbqzGdKjdoEUarNXbh7ieSkUnJoK9kv9ea_nM8pQ5yu2w_9AbbokSFbjHpIURxua3HYmqtyimHqZ4ig8hQex_2F8gQrv_WrjvsCFeC2RzrLn0m_F_4OGdARq_cNxnG7jSYm9QoXfQJYkS8sHdh_Edc1kaSaj25pQqFuTn9uPxGr6zTBnpKVvUPgRNipCMSLMOzNUeF_9r6urUx_27gLDIzGvRdfHiNd4fv3kqwlvPZxfzw7zvNkum5CdY7V0RWh3VzJFoZYOT67kGzSLEn1JAeS7iaM6M1-LHiEuuRbeGI-nPe8RqLYW6Sv-QE2ppyeHVPHaNc-zlb37nJW3AeTGZJP_a0fhNHJTEsn0_cWxbUDcuKIH4lrj7mhB0IpdgIUDcv0cQCvUzBBVHxZADqpTvhlwle3RY0Sh2KxHHm5gVl9r95kJ9tZ2yoNIzThARJQCoYG; LogLogin=true; _ga_NSH0J47TD8=GS2.1.s1766238838$o9$g1$t1766238876$j22$l0$h0; .AspNetCore.Mvc.CookieTempDataProvider=CfDJ8BBA3arab1VIljiAtyr-lkc5wWzckpQ4eBpCwVB7J1IOLgAoqp70XWOJbsQrliksxReosWjRJldPuW7jeNiZhUExN8JgooXD7LRAetiY00dLJ3o-0vO6cLRWAPtAwqmCZcP8ZxQE_Nyzn4Stttgi9eCwyE2uaqGYLdhFMG-Xn1aQnAe5NTJ-HIot29T4bo8mkGtQO0bTNjHotN0bwVn01w8CsiGXsPdcE_ECWBqL1Ou9n8_Ntxf5xWOJ1h8PRXDz9g';

// Marka JSON verisi
const BRANDS_JSON = [
  { "id": 576, "marka": "ADRIA" },
  { "id": 705, "marka": "AIXAM" },
  { "id": 736, "marka": "AKIA" },
  { "id": 3, "marka": "ALFA ROMEO" },
  { "id": 601, "marka": "ALKE" },
  { "id": 587, "marka": "ALPINE" },
  { "id": 556, "marka": "AR-BUS" },
  { "id": 554, "marka": "ASKAM/FARGO/DESOTO" },
  { "id": 8, "marka": "ASTON MARTIN" },
  { "id": 725, "marka": "ASTRA" },
  { "id": 9, "marka": "AUDI" },
  { "id": 726, "marka": "AVIA" },
  { "id": 558, "marka": "BENTLEY" },
  { "id": 27, "marka": "BMC" },
  { "id": 21, "marka": "BMW" },
  { "id": 574, "marka": "BOZANKAYA" },
  { "id": 729, "marka": "BREDAMENARIBUS" },
  { "id": 596, "marka": "BRILLIANCE" },
  { "id": 801, "marka": "BUGATTI" },
  { "id": 25, "marka": "BUICK" },
  { "id": 741, "marka": "BYD" },
  { "id": 31, "marka": "CADILLAC" },
  { "id": 452, "marka": "CATERHAM" },
  { "id": 456, "marka": "CHANGAN" },
  { "id": 721, "marka": "CHERY" },
  { "id": 32, "marka": "CHEVROLET" },
  { "id": 33, "marka": "CHRYSLER" },
  { "id": 34, "marka": "CITROEN" },
  { "id": 591, "marka": "CUPRA" },
  { "id": 445, "marka": "DACIA" },
  { "id": 30, "marka": "DAEWOO" },
  { "id": 43, "marka": "DAIHATSU" },
  { "id": 806, "marka": "DFSK" },
  { "id": 593, "marka": "DONG FENG" },
  { "id": 748, "marka": "DS" },
  { "id": 50, "marka": "FERRARI" },
  { "id": 52, "marka": "FIAT" },
  { "id": 53, "marka": "FORD" },
  { "id": 177, "marka": "HYUNDAI" },
  { "id": 61, "marka": "HONDA" },
  { "id": 800, "marka": "KIA" },
  { "id": 83, "marka": "LADA" },
  { "id": 420, "marka": "LAND ROVER" },
  { "id": 571, "marka": "LEXUS" },
  { "id": 90, "marka": "MERCEDES" },
  { "id": 588, "marka": "MG" },
  { "id": 421, "marka": "MINI" },
  { "id": 94, "marka": "MITSUBISHI" },
  { "id": 107, "marka": "NISSAN" },
  { "id": 111, "marka": "OPEL" },
  { "id": 114, "marka": "PEUGEOT" },
  { "id": 118, "marka": "PORSCHE" },
  { "id": 123, "marka": "RENAULT" },
  { "id": 133, "marka": "SKODA" },
  { "id": 137, "marka": "SUBARU" },
  { "id": 130, "marka": "SUZUKI" },
  { "id": 454, "marka": "TESLA" },
  { "id": 850, "marka": "TOGG" },
  { "id": 144, "marka": "TOYOTA" },
  { "id": 153, "marka": "VOLKSWAGEN" },
  { "id": 154, "marka": "VOLVO" }
];

/**
 * Belirli bir marka için modelleri API'den çeker (retry mekanizması ile)
 */
async function fetchModelsForBrand(
  brandId: number,
  brandName: string,
  retries: number = 3
): Promise<any[]> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
  try {
    const response = await axios.post(
      API_URL,
      `value=${brandId}&type=ddlAracMarka`,
      {
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9,tr;q=0.8',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'cookie': COOKIE_STRING,
          'origin': 'https://open.techdestekasist.com',
          'referer': 'https://open.techdestekasist.com/bayi/satinal',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          'x-requested-with': 'XMLHttpRequest',
            'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'priority': 'u=1, i',
        },
        timeout: 30000,
      }
    );

      // Response'u detaylı logla (ilk denemede)
      if (attempt === 1) {
        console.log(`    📥 API Response Status: ${response.status}`);
        console.log(`    📥 API Response Data Type: ${typeof response.data}`);
        if (response.data) {
          console.log(`    📥 API Response Keys: ${Object.keys(response.data).join(', ')}`);
        }
      }

      // API response'unu detaylı logla (ilk denemede ve boş gelirse)
      if (attempt === 1) {
        console.log(`    📥 Full API Response:`, JSON.stringify(response.data).substring(0, 500));
      }

      // Farklı response formatlarını handle et - ADAM AKILLI SİSTEM
      let models: any[] = [];

      // Format 1: response.data.model (array) - EN YAYGIN FORMAT
    if (response.data && response.data.model && Array.isArray(response.data.model)) {
        models = response.data.model;
        console.log(`    ✅ Found models in 'model' key: ${models.length} items`);
      }
      // Format 2: response.data direkt array
      else if (Array.isArray(response.data)) {
        models = response.data;
        console.log(`    ✅ Found models as direct array: ${models.length} items`);
      }
      // Format 3: response.data içinde başka bir key (marka, models, items, vs.)
      else if (response.data && typeof response.data === 'object') {
        // Tüm key'leri kontrol et - hangi key'de array varsa onu kullan
        const possibleKeys = ['model', 'models', 'marka', 'items', 'data', 'results'];
        for (const key of possibleKeys) {
          if (response.data[key] && Array.isArray(response.data[key])) {
            models = response.data[key];
            console.log(`    ✅ Found models in '${key}' key: ${models.length} items`);
            break;
          }
        }
        
        // Eğer yukarıdaki key'lerde bulamadıysak, tüm key'leri kontrol et
        if (models.length === 0) {
          for (const key of Object.keys(response.data)) {
            if (Array.isArray(response.data[key]) && response.data[key].length > 0) {
              // İlk elemana bak, eğer model formatındaysa (value, text, id gibi field'ları varsa) kullan
              const firstItem = response.data[key][0];
              if (firstItem && (firstItem.value || firstItem.text || firstItem.id || firstItem.name)) {
                models = response.data[key];
                console.log(`    ✅ Found models in '${key}' key: ${models.length} items`);
                break;
              }
            }
          }
        }
      }

      // Modelleri parse et - HER ŞEYİ KAYDET, VALUE ZORUNLU DEĞİL
      if (models.length > 0) {
        const parsedModels = models
          .map((m: any, index: number) => {
            try {
              // Geçerli model objesi kontrolü
              if (!m || typeof m !== 'object') {
                console.log(`    ⚠️  Skipping invalid model at index ${index}:`, m);
                return null;
              }
              
              // Farklı field isimlerini handle et - TÜM OLASI FORMATLAR
              const value = m.value || m.Value || m.id || m.Id || m.modelId || m.model_id || '';
              const text = m.text || m.Text || m.name || m.Name || m.label || m.Label || '';
              
              // ID'yi parse et - HER ZAMAN BENZERSİZ ID OLUŞTUR (brand_id * 1000000 + value)
              // Bu sayede aynı value'ye sahip modeller farklı markalarda olsa bile çakışma olmaz
              let modelId: number;
              let modelValue: number = 0;
              
              if (value) {
                if (typeof value === 'number') {
                  modelValue = value;
                } else if (typeof value === 'string' && value.trim()) {
                  const parsed = parseInt(value.trim());
                  if (!isNaN(parsed) && parsed > 0) {
                    modelValue = parsed;
                  } else {
                    // Value geçersizse, index kullan
                    modelValue = index + 1;
                  }
                } else {
                  // Value yoksa veya geçersizse, index kullan
                  modelValue = index + 1;
                }
              } else {
                // Value yoksa, index kullan
                modelValue = index + 1;
              }
              
              // Benzersiz ID oluştur: brand_id * 1000000 + modelValue
              // Bu sayede her marka için 1 milyon model ID'si ayrılır
              modelId = brandId * 1000000 + modelValue;

              // Model adını temizle - "1001 - MODEL ADI" formatını handle et
              let modelName = String(text || `Model ${index + 1}`).trim();
              
              // Başındaki sayı ve tire'yi temizle
              modelName = modelName.replace(/^\d+\s*-\s*/, ''); // "1001 - MODEL ADI" -> "MODEL ADI"
              modelName = modelName.replace(/^\d+\s+/, ''); // "1001 MODEL ADI" -> "MODEL ADI"
              modelName = modelName.replace(/^-\s*/, ''); // "- MODEL ADI" -> "MODEL ADI"
              modelName = modelName.trim();
              
              // İsim boşsa, default isim kullan
              if (!modelName || modelName.length === 0) {
                modelName = `Model ${modelId}`;
                console.log(`    ⚠️  Empty model name, using default: "${modelName}"`);
              }

              return {
                id: modelId,
        brand_id: brandId,
                name: modelName,
                value: value ? String(value) : null, // Value zorunlu değil
              };
            } catch (error: any) {
              console.log(`    ❌ Error parsing model at index ${index}:`, error.message, m);
              return null;
            }
          })
          .filter((m: any) => m !== null); // null değerleri filtrele

        if (parsedModels.length > 0) {
          console.log(`    ✅ Successfully parsed ${parsedModels.length}/${models.length} models (attempt ${attempt}/${retries})`);
          return parsedModels;
        } else {
          console.log(`    ⚠️  No valid models parsed from ${models.length} items`);
          // İlk denemede detaylı log
          if (attempt === 1 && models.length > 0) {
            console.log(`    📋 Sample model item:`, JSON.stringify(models[0]));
          }
        }
      } else {
        if (attempt === 1) {
          console.log(`    ⚠️  No models array found in response. Response keys:`, Object.keys(response.data || {}));
          console.log(`    📥 Response data sample:`, JSON.stringify(response.data).substring(0, 500));
        }
      }

      // Boş response ise retry yap
      if (models.length === 0 && attempt < retries) {
        const delay = attempt * 1000; // 1s, 2s, 3s
        console.log(`    🔄 Retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

    return [];

  } catch (error: any) {
      lastError = error;
      const errorMsg = error.response?.data || error.message || 'Unknown error';
      console.log(`    ❌ Attempt ${attempt}/${retries} failed: ${errorMsg}`);
      
      if (attempt < retries) {
        const delay = attempt * 1000; // Exponential backoff
        console.log(`    🔄 Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Tüm denemeler başarısız
  console.error(`  ❌ All ${retries} attempts failed for ${brandName} (${brandId}):`, lastError?.message || 'Unknown error');
  return [];
}

/**
 * Ana script fonksiyonu
 */
async function scrapeAllCarModels() {
  console.log('🚀 Starting car brands & models scraper (Improved Version)...\n');

  // Veritabanı bağlantısını başlat
  await AppDataSource.initialize();
  console.log('✓ Database connected\n');

  const brandRepository = AppDataSource.getRepository(CarBrand);
  const modelRepository = AppDataSource.getRepository(CarModel);

  // Step 1: Mevcut tüm markaları sil (replace_all stratejisi)
  console.log('🗑️  Step 1: Deleting existing brands...\n');
  const existingBrands = await brandRepository.find();
  if (existingBrands.length > 0) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
      await queryRunner.query('DELETE FROM `cars_models`');
      console.log(`  ✓ Deleted all existing models`);
      await queryRunner.query('DELETE FROM `cars_brands`');
      console.log(`  ✓ Deleted ${existingBrands.length} existing brands`);
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      await queryRunner.release();
    }
    console.log('');
  } else {
    console.log('  ✓ No existing brands to delete\n');
  }

  // Step 2: JSON'daki markaları ekle
  console.log(`📦 Step 2: Adding ${BRANDS_JSON.length} brands from JSON...\n`);
  let brandsCreated = 0;
  
  for (const brandData of BRANDS_JSON) {
    try {
      const brand = brandRepository.create({
        id: brandData.id,
        name: brandData.marka,
      });
      await brandRepository.save(brand);
      brandsCreated++;
    } catch (error: any) {
      console.error(`  ❌ Error creating brand ${brandData.marka} (${brandData.id}):`, error.message);
    }
  }
  
  console.log(`✅ Brands: ${brandsCreated}/${BRANDS_JSON.length} created\n`);

  // Step 3: Her marka için modelleri çek ve kaydet
  console.log(`🚙 Step 3: Fetching models for ${BRANDS_JSON.length} brands...\n`);

  let totalModels = 0;
  let totalCreatedCount = 0;
  let totalUpdatedCount = 0;
  let totalErrorCount = 0;
  let successCount = 0;
  let failCount = 0;
  const failedBrands: Array<{ id: number; name: string; reason: string }> = [];

  const startTime = Date.now();

  for (let i = 0; i < BRANDS_JSON.length; i++) {
    const brandData = BRANDS_JSON[i];
    const progress = `[${i + 1}/${BRANDS_JSON.length}]`;
    
    console.log(`\n${progress} 📋 Processing: ${brandData.marka} (ID: ${brandData.id})`);

    const models = await fetchModelsForBrand(brandData.id, brandData.marka);

    if (models.length > 0) {
      let brandCreatedCount = 0;
      let brandUpdatedCount = 0;
      let brandErrorCount = 0;

      // HER MODELİ AYRI AYRI KAYDET - HİÇBİRİNİ ATLAMA
      for (const modelData of models) {
        try {
          // Önce mevcut modeli kontrol et (id ve brand_id kombinasyonuna göre)
          const existing = await modelRepository.findOne({
            where: { 
              id: modelData.id,
              brand_id: modelData.brand_id 
            },
          });

          if (!existing) {
            // Yeni model - kaydet
            try {
              const newModel = modelRepository.create({
                id: modelData.id,
                brand_id: modelData.brand_id,
                name: modelData.name,
                value: modelData.value || null,
              });
              await modelRepository.save(newModel);
              brandCreatedCount++;
              totalCreatedCount++;
            } catch (saveError: any) {
              // Duplicate key hatası alırsak (çok nadir olmalı çünkü benzersiz ID oluşturuyoruz)
              if (saveError.code === 'ER_DUP_ENTRY' || saveError.message?.includes('Duplicate entry')) {
                // Mevcut modeli update et
                const existingById = await modelRepository.findOne({
                  where: { id: modelData.id },
                });
                if (existingById) {
                  existingById.name = modelData.name;
                  existingById.brand_id = modelData.brand_id;
                  existingById.value = modelData.value || null;
                  await modelRepository.save(existingById);
                  brandUpdatedCount++;
                  totalUpdatedCount++;
                } else {
                  brandErrorCount++;
                  totalErrorCount++;
                  console.error(`    ❌ Duplicate key but model not found: ID ${modelData.id}, Brand: ${modelData.brand_id}`);
                }
              } else {
                brandErrorCount++;
                totalErrorCount++;
                console.error(`    ❌ Error saving model "${modelData.name}" (ID: ${modelData.id}, Brand: ${modelData.brand_id}):`, saveError.message);
              }
            }
          } else {
            // Mevcut model - değişmişse update et
            if (existing.name !== modelData.name || existing.brand_id !== modelData.brand_id || existing.value !== modelData.value) {
              existing.name = modelData.name;
              existing.brand_id = modelData.brand_id;
              existing.value = modelData.value || null;
              await modelRepository.save(existing);
              brandUpdatedCount++;
              totalUpdatedCount++;
            }
          }
        } catch (error: any) {
          brandErrorCount++;
          totalErrorCount++;
          console.error(`    ❌ Error processing model "${modelData.name}" (ID: ${modelData.id}):`, error.message);
        }
      }
      
      console.log(`  ✅ ${models.length} models processed (${brandCreatedCount} new, ${brandUpdatedCount} updated${brandErrorCount > 0 ? `, ${brandErrorCount} errors` : ''})`);
      totalModels += models.length;
      successCount++;
    } else {
      console.log(`  ⚠️  No models found for ${brandData.marka}`);
      failCount++;
      failedBrands.push({ 
        id: brandData.id, 
        name: brandData.marka,
        reason: 'No models returned from API'
      });
    }

    // Rate limiting - API'yi spam'lememek için (500ms delay)
    if (i < BRANDS_JSON.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Progress update every 10 brands
    if ((i + 1) % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const avgTime = (parseFloat(elapsed) / (i + 1)).toFixed(2);
      const remaining = ((BRANDS_JSON.length - i - 1) * parseFloat(avgTime)).toFixed(0);
      console.log(`\n📊 Progress: ${i + 1}/${BRANDS_JSON.length} brands processed`);
      console.log(`   ⏱️  Elapsed: ${elapsed}s | Avg: ${avgTime}s/brand | Est. remaining: ${remaining}s`);
      console.log(`   ✅ Success: ${successCount} | ❌ Failed: ${failCount} | 📦 Models: ${totalModels}\n`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // Veritabanındaki toplam model sayısını kontrol et
  const dbModelCount = await modelRepository.count();
  const expectedCount = totalCreatedCount + totalUpdatedCount;

  console.log('\n' + '='.repeat(70));
  console.log('✅ SCRAPING COMPLETED!');
  console.log('='.repeat(70));
  console.log(`📊 Summary:`);
  console.log(`   - Total brands: ${BRANDS_JSON.length}`);
  console.log(`   - Brands created: ${brandsCreated}`);
  console.log(`   - Successful API calls: ${successCount}`);
  console.log(`   - Failed API calls: ${failCount}`);
  console.log(`   - Total models found from API: ${totalModels}`);
  console.log(`   - New models created: ${totalCreatedCount}`);
  console.log(`   - Models updated: ${totalUpdatedCount}`);
  console.log(`   - Total errors: ${totalErrorCount}`);
  console.log(`   - Total models in database: ${dbModelCount}`);
  console.log(`   - Expected total: ${expectedCount}`);
  
  // Doğrulama
  if (dbModelCount === totalModels) {
    console.log(`   ✅ VERIFICATION: All ${totalModels} models successfully saved to database!`);
  } else if (dbModelCount < totalModels) {
    const missing = totalModels - dbModelCount;
    console.log(`   ⚠️  WARNING: ${missing} models may not have been saved (DB: ${dbModelCount}, Expected: ${totalModels})`);
  } else {
    console.log(`   ℹ️  INFO: Database has more models than expected (DB: ${dbModelCount}, Expected: ${totalModels})`);
  }
  
  console.log(`   - Total time: ${totalTime}s`);
  console.log(`   - Average: ${(parseFloat(totalTime) / BRANDS_JSON.length).toFixed(2)}s per brand`);

  if (failedBrands.length > 0) {
    console.log(`\n⚠️  Failed brands (${failedBrands.length}):`);
    failedBrands.forEach(b => console.log(`   - ${b.id}: ${b.name} (${b.reason})`));
  }

  console.log('='.repeat(70) + '\n');

  await AppDataSource.destroy();
  console.log('✓ Database connection closed');
}

// Script'i çalıştır
scrapeAllCarModels().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

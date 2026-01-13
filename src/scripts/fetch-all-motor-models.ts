import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { MotorBrand } from '../entities/MotorBrand';
import { MotorModel } from '../entities/MotorModel';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Motor Marka ve Model Script
 * motor.json dosyasından markaları ve modelleri okuyup veritabanına kaydeder
 */

// motor.json dosyasını oku
const motorJsonPath = path.join(__dirname, '../../motor.json');
const motorData = JSON.parse(fs.readFileSync(motorJsonPath, 'utf-8'));

/**
 * Ana script fonksiyonu
 */
async function scrapeAllMotorModels() {
  console.log('🚀 Starting motor brands & models scraper...\n');

  // Veritabanı bağlantısını başlat
  await AppDataSource.initialize();
  console.log('✓ Database connected\n');

  const brandRepository = AppDataSource.getRepository(MotorBrand);
  const modelRepository = AppDataSource.getRepository(MotorModel);

  // Step 1: Mevcut tüm markaları ve modelleri sil (replace_all stratejisi)
  console.log('🗑️  Step 1: Deleting existing brands and models...\n');
  const existingBrands = await brandRepository.find();
  if (existingBrands.length > 0) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
      await queryRunner.query('DELETE FROM `motor_models`');
      console.log(`  ✓ Deleted all existing motor models`);
      await queryRunner.query('DELETE FROM `motor_brands`');
      console.log(`  ✓ Deleted ${existingBrands.length} existing motor brands`);
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      await queryRunner.release();
    }
    console.log('');
  } else {
    console.log('  ✓ No existing brands to delete\n');
  }

  // Step 2: JSON'daki markaları ve modelleri ekle
  const brands = motorData.data.brands;
  const brandNames = Object.keys(brands);
  
  console.log(`📦 Step 2: Processing ${brandNames.length} motor brands from JSON...\n`);

  let brandsCreated = 0;
  let totalModels = 0;
  let totalCreatedCount = 0;
  let totalUpdatedCount = 0;
  let totalErrorCount = 0;

  const startTime = Date.now();

  // Her marka için işlem yap
  for (let i = 0; i < brandNames.length; i++) {
    const brandName = brandNames[i];
    const models = brands[brandName];
    const progress = `[${i + 1}/${brandNames.length}]`;
    
    console.log(`${progress} 📋 Processing: ${brandName} (${models.length} models)`);

    try {
      // Markayı oluştur
      const brand = brandRepository.create({
        name: brandName,
      });
      const savedBrand = await brandRepository.save(brand);
      brandsCreated++;

      // Bu markaya ait modelleri ekle
      let brandCreatedCount = 0;
      let brandUpdatedCount = 0;
      let brandErrorCount = 0;

      for (let j = 0; j < models.length; j++) {
        const modelName = models[j];
        
        try {
          // Model adını temizle
          let cleanModelName = String(modelName).trim();
          
          // İsim boşsa, default isim kullan
          if (!cleanModelName || cleanModelName.length === 0) {
            cleanModelName = `Model ${j + 1}`;
            console.log(`    ⚠️  Empty model name, using default: "${cleanModelName}"`);
          }

          // Mevcut modeli kontrol et (brand_id ve name kombinasyonuna göre)
          const existing = await modelRepository.findOne({
            where: { 
              brand_id: savedBrand.id,
              name: cleanModelName
            },
          });

          if (!existing) {
            // Yeni model - kaydet
            try {
              const newModel = modelRepository.create({
                brand_id: savedBrand.id,
                name: cleanModelName,
              });
              await modelRepository.save(newModel);
              brandCreatedCount++;
              totalCreatedCount++;
            } catch (saveError: any) {
              brandErrorCount++;
              totalErrorCount++;
              console.error(`    ❌ Error saving model "${cleanModelName}":`, saveError.message);
            }
          } else {
            // Mevcut model - değişmişse update et
            if (existing.name !== cleanModelName) {
              existing.name = cleanModelName;
              await modelRepository.save(existing);
              brandUpdatedCount++;
              totalUpdatedCount++;
            }
          }
        } catch (error: any) {
          brandErrorCount++;
          totalErrorCount++;
          console.error(`    ❌ Error processing model "${models[j]}":`, error.message);
        }
      }
      
      console.log(`  ✅ ${models.length} models processed (${brandCreatedCount} new, ${brandUpdatedCount} updated${brandErrorCount > 0 ? `, ${brandErrorCount} errors` : ''})`);
      totalModels += models.length;
    } catch (error: any) {
      console.error(`  ❌ Error creating brand ${brandName}:`, error.message);
    }

    // Progress update every 20 brands
    if ((i + 1) % 20 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const avgTime = (parseFloat(elapsed) / (i + 1)).toFixed(2);
      const remaining = ((brandNames.length - i - 1) * parseFloat(avgTime)).toFixed(0);
      console.log(`\n📊 Progress: ${i + 1}/${brandNames.length} brands processed`);
      console.log(`   ⏱️  Elapsed: ${elapsed}s | Avg: ${avgTime}s/brand | Est. remaining: ${remaining}s`);
      console.log(`   ✅ Brands: ${brandsCreated} | 📦 Models: ${totalModels}\n`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // Veritabanındaki toplam model sayısını kontrol et
  const dbModelCount = await modelRepository.count();
  const dbBrandCount = await brandRepository.count();
  const expectedCount = totalCreatedCount + totalUpdatedCount;

  console.log('\n' + '='.repeat(70));
  console.log('✅ SCRAPING COMPLETED!');
  console.log('='.repeat(70));
  console.log(`📊 Summary:`);
  console.log(`   - Total brands in JSON: ${brandNames.length}`);
  console.log(`   - Brands created: ${brandsCreated}`);
  console.log(`   - Total brands in database: ${dbBrandCount}`);
  console.log(`   - Total models found from JSON: ${totalModels}`);
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
  console.log(`   - Average: ${(parseFloat(totalTime) / brandNames.length).toFixed(2)}s per brand`);

  console.log('='.repeat(70) + '\n');

  await AppDataSource.destroy();
  console.log('✓ Database connection closed');
}

// Script'i çalıştır
scrapeAllMotorModels().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

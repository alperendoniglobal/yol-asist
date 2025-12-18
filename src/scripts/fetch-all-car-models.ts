import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { CarBrand } from '../entities/CarBrand';
import { CarModel } from '../entities/CarModel';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = 'https://open.techdestekasist.com/bayi/ajax/MarkaModel';
const COOKIE_STRING = '_ga=GA1.1.1748018400.1764179755; ARRAffinity1=705e227ad8a19aa24032b76632992116929e2b2b8e349cba9cf4d92887f73c88; .AspNetCore.Antiforgery.geKjHJPc-IM=CfDJ8NN7fWJQlt1Em9DGf5xIdpKVosaUUzcPMQ6mMzI9QLltdPtIPdftUvzL8uFO8qa6EdWtUV5MuDcbdfRPC01QLy0MoZS2vr0awY2RGuDUyzyzmfsdNh6Y1iS21-XydPOyKgHg6RQWthu0qqrOVG83G7A; OpenAsistansSesion=CfDJ8NN7fWJQlt1Em9DGf5xIdpIql7YlzTVe5bQmO7eTdaUQEixYjKm_YgVy118j2342nhqnY307s51YcYTWbKxHzdUqyx0SJHtsRKt5_T_YCGQE9rRRXI4GJi_8E2Ar5lRRnx7USU1pxMwYagA3ZGq9aFjRFCb6E_M0KZoxajaJ3pSEPCeiuCweC91jdPU05FRq1QxoquKfy_nHBb9dfNxv8AO7gD8VHVNsnDR1xFrGcSctD3oiE76RuAwxVgJHHRui2gVTAybvYoU4THzMfMBsC9yCitCFkfH55OczPvIH6mDZtw_NSePj5hC3r5pmL3XefW2Zk8pjWXYm6J6KZSD8aQrUzP-kpIbpNq4EjbqllC-A1lY8A5yo31MtK_lpWXyF22FprWqtLMU2BzQfBHyYIB-mteagq0zqOJVNSSei1F_3lFZac6KUSZeTS4YmSYKdNU7G5YNB0M_tgL1xCdW8ZhNrjcwQal_pHwQo1YTvv4uW2ZXgUCYhdD9Uq0t0LD6G0FIG-TYTt10k-BKhHmSbMbV3onlOnx0jAJS6A0DpUle_YVvy8Us56_J-UX82AxGqKrrbk-vymIdf8CEYAWgcD0mjJwWaQrmzc4uZYe2JV4JBjAzyY66fYwqmtjGKpsGZrKzvtFT7oPOlE_dLvFmwxuqiwDmgHv0z9PWzQUSJ5uX1-oeM57ZmnH8lmrGwuzGVqZ2XiXEtCHgKJfc7aVC1wgdx-ZKK8DRoJ9zn66FqL_lz1ApVm556Lk5KBfvfQREHeJPfWm79Zm7i47CSHBXgJ-zl8Nkw7cW60FXpITU6qr40MczbO9xAqexQUo3I9ebOCJ-7mi6OX2gQWFBnLwobuhw; LogLogin=true; _ga_NSH0J47TD8=GS2.1.s1764588959$o8$g0$t1764588962$j57$l0$h0; .AspNetCore.Mvc.CookieTempDataProvider=CfDJ8NN7fWJQlt1Em9DGf5xIdpI3HY34B9HyHIlS9A4CTV6UW14xD6Ou8f2znO7Je_ofuf6QjxEbAOr2DkZU9J3X6WSYYNRfxzm9vX36HGxte6090f1JLkQfkL3uYa4trkTLh6D79xfd3G0W_05aFmpdkdlBKerGQvF-MQXw1WRiBVsK1hxAFOKuVES4Bvd3J6StaU7KxhHtSURKdmdqlHKiyprFoWUubMv7s6BG6s9Tc4f8_rg-ALscIPT7V9mmSSjiCA';
const AUTH_HEADER = 'Basic dGF0aWxidWR1cmFwaTphdHZTbkJnYWx4WjI2Uzc=';

async function fetchModelsForBrand(brandId: number, brandName: string): Promise<any[]> {
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
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          'x-requested-with': 'XMLHttpRequest',
          'authorization': AUTH_HEADER,
        },
        timeout: 30000,
      }
    );

    if (response.data && response.data.model && Array.isArray(response.data.model)) {
      return response.data.model.map((m: any) => ({
        id: parseInt(m.value),
        brand_id: brandId,
        name: m.text.replace(/^\d+\s*-\s*/, '').trim(), // "1001 - MODEL ADI" -> "MODEL ADI"
        value: m.value, // API'den gelen value değerini de kaydet
      }));
    }
    return [];
  } catch (error: any) {
    console.error(`  ❌ Error fetching models for ${brandName} (${brandId}):`, error.message);
    return [];
  }
}

async function scrapeAllCarModels() {
  console.log('🚀 Starting car brands & models scraper...\n');

  // Initialize database
  await AppDataSource.initialize();
  console.log('✓ Database connected\n');

  const brandRepository = AppDataSource.getRepository(CarBrand);
  const modelRepository = AppDataSource.getRepository(CarModel);

  // Step 1: Parse and save all brands from cars.md
  console.log('📦 Step 1: Parsing brands from cars.md...\n');
  const carsMdPath = path.join(__dirname, '../../cars.md');
  const content = fs.readFileSync(carsMdPath, 'utf-8');

  // Parse brands from HTML option tags
  const brandRegex = /<option value="(\d+)"[^>]*>(\d+)-(.+?)<\/option>/g;
  const brandsData: Array<{ id: number; name: string }> = [];
  let match;

  while ((match = brandRegex.exec(content)) !== null) {
    const id = parseInt(match[1]);
    const name = match[3].trim();
    
    // Skip duplicates
    if (!brandsData.find(b => b.id === id)) {
      brandsData.push({ id, name });
    }
  }

  console.log(`   Found ${brandsData.length} brands in cars.md\n`);

  // Save brands to database
  let brandsCreated = 0;
  let brandsExisting = 0;
  for (const brandData of brandsData) {
    const existing = await brandRepository.findOne({
      where: { id: brandData.id },
    });

    if (!existing) {
      const brand = brandRepository.create(brandData);
      await brandRepository.save(brand);
      brandsCreated++;
    } else {
      brandsExisting++;
    }
  }

  console.log(`✅ Brands: ${brandsCreated} created, ${brandsExisting} already exist\n`);

  // Step 2: Get all brands from database
  const brands = await brandRepository.find({
    order: { id: 'ASC' },
  });

  console.log(`🚙 Step 2: Fetching models for ${brands.length} brands...\n`);

  let totalModels = 0;
  let totalCreatedCount = 0;
  let totalExistingCount = 0;
  let successCount = 0;
  let failCount = 0;
  const failedBrands: Array<{ id: number; name: string }> = [];

  const startTime = Date.now();

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    const progress = `[${i + 1}/${brands.length}]`;
    
    console.log(`${progress} Fetching models for ${brand.name} (ID: ${brand.id})...`);

    const models = await fetchModelsForBrand(brand.id, brand.name);

    if (models.length > 0) {
      let brandCreatedCount = 0;
      let brandExistingCount = 0;

      for (const modelData of models) {
        const existing = await modelRepository.findOne({
          where: { id: modelData.id },
        });

        if (!existing) {
          const model = modelRepository.create(modelData);
          await modelRepository.save(model);
          brandCreatedCount++;
          totalCreatedCount++;
        } else {
          brandExistingCount++;
          totalExistingCount++;
        }
      }
      
      console.log(`  ✓ ${models.length} models found (${brandCreatedCount} new, ${brandExistingCount} existing)`);
      totalModels += models.length;
      successCount++;
    } else {
      console.log(`  ⚠️  No models found`);
      failCount++;
      failedBrands.push({ id: brand.id, name: brand.name });
    }

    // Rate limiting - be nice to the API (500ms delay between requests)
    if (i < brands.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Progress update every 10 brands
    if ((i + 1) % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const avgTime = (elapsed as any / (i + 1)).toFixed(2);
      const remaining = ((brands.length - i - 1) * parseFloat(avgTime)).toFixed(0);
      console.log(`\n📊 Progress: ${i + 1}/${brands.length} brands processed`);
      console.log(`   ⏱️  Elapsed: ${elapsed}s | Avg: ${avgTime}s/brand | Est. remaining: ${remaining}s\n`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('✅ SCRAPING COMPLETED!');
  console.log('='.repeat(60));
  console.log(`📊 Summary:`);
  console.log(`   - Total brands: ${brands.length}`);
  console.log(`   - Successful: ${successCount}`);
  console.log(`   - Failed: ${failCount}`);
  console.log(`   - Total models found: ${totalModels}`);
  console.log(`   - New models created: ${totalCreatedCount}`);
  console.log(`   - Existing models: ${totalExistingCount}`);
  console.log(`   - Total time: ${totalTime}s`);
  console.log(`   - Average: ${(parseFloat(totalTime) / brands.length).toFixed(2)}s per brand`);

  if (failedBrands.length > 0) {
    console.log(`\n⚠️  Failed brands (${failedBrands.length}):`);
    failedBrands.forEach(b => console.log(`   - ${b.id}: ${b.name}`));
  }

  console.log('='.repeat(60) + '\n');

  await AppDataSource.destroy();
  console.log('✓ Database connection closed');
}

// Run scraper
scrapeAllCarModels().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


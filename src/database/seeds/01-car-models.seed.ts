import { AppDataSource } from '../../config/database';
import { CarModel } from '../../entities/CarModel';
import { CarBrand } from '../../entities/CarBrand';
import axios from 'axios';

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
      }));
    }
    return [];
  } catch (error: any) {
    console.error(`  ❌ Error fetching models for ${brandName} (${brandId}):`, error.message);
    return [];
  }
}

export const seedCarModels = async () => {
  const modelRepository = AppDataSource.getRepository(CarModel);
  const brandRepository = AppDataSource.getRepository(CarBrand);

  const brands = await brandRepository.find({
    order: { id: 'ASC' },
  });

  console.log(`🚙 Fetching models for ${brands.length} brands...\n`);

  let totalModels = 0;
  let totalCreatedCount = 0;
  let totalExistingCount = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    console.log(`[${i + 1}/${brands.length}] Fetching models for ${brand.name} (ID: ${brand.id})...`);

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
    }

    // Rate limiting - be nice to the API
    if (i < brands.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between requests
    }
  }

  console.log(`\n✅ Model fetching completed!`);
  console.log(`📊 Summary:`);
  console.log(`  - Total brands: ${brands.length}`);
  console.log(`  - Successful: ${successCount}`);
  console.log(`  - Failed: ${failCount}`);
  console.log(`  - Total models: ${totalModels}`);
  console.log(`  - New models: ${totalCreatedCount}`);
  console.log(`  - Existing models: ${totalExistingCount}`);
};


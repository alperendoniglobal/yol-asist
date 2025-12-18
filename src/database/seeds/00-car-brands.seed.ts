import { AppDataSource } from '../../config/database';
import { CarBrand } from '../../entities/CarBrand';
import * as fs from 'fs';
import * as path from 'path';

export const seedCarBrands = async () => {
  const brandRepository = AppDataSource.getRepository(CarBrand);

  // Read cars.md file
  const carsMdPath = path.join(__dirname, '../../../cars.md');
  const content = fs.readFileSync(carsMdPath, 'utf-8');

  // Parse brands from HTML option tags
  const brandRegex = /<option value="(\d+)"[^>]*>(\d+)-(.+?)<\/option>/g;
  const brands: Array<{ id: number; name: string }> = [];
  let match;

  while ((match = brandRegex.exec(content)) !== null) {
    const id = parseInt(match[1]);
    const name = match[3].trim();
    
    // Skip duplicates
    if (!brands.find(b => b.id === id)) {
      brands.push({ id, name });
    }
  }

  console.log(`📦 Found ${brands.length} brands in cars.md`);

  let createdCount = 0;
  let existingCount = 0;

  for (const brandData of brands) {
    const existing = await brandRepository.findOne({
      where: { id: brandData.id },
    });

    if (!existing) {
      const brand = brandRepository.create(brandData);
      await brandRepository.save(brand);
      createdCount++;
      console.log(`  ✓ Created: ${brandData.id} - ${brandData.name}`);
    } else {
      existingCount++;
    }
  }

  console.log(`✅ Brands: ${createdCount} created, ${existingCount} already exist`);
  return brands;
};


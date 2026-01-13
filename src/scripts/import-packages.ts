import 'reflect-metadata';
import dotenv from 'dotenv';
import * as path from 'path';
import { AppDataSource } from '../config/database';
import { Package } from '../entities/Package';
import { PackageCover } from '../entities/PackageCover';
import { EntityStatus } from '../types/enums';
import * as fs from 'fs';

// Environment variables'ı yükle
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Paket İçe Aktarma Script'i
 * paketler.json dosyasındaki paketleri ve kapsamlarını veritabanına ekler
 * 
 * JSON Formatı:
 * {
 *   "paket_adi": "Hususi Paket (T)",
 *   "fiyat": "1,000.00 ₺",
 *   "tur": "Otomobil",
 *   "yas_siniri": 40,
 *   "icindekiler": [
 *     "2 Çekici Hizmeti Kaza (14,000.00 TL'ye Kadar)",
 *     "1 Lastik Patlaması (2,000.00 TL'ye Kadar)"
 *   ]
 * }
 */

const PACKAGES_JSON_PATH = path.resolve(__dirname, '../../paketler.json');

/**
 * Fiyat string'ini number'a çevirir
 * "1,000.00 ₺" -> 1000.00
 */
function parsePrice(priceString: string): number {
  // ₺ işaretini ve boşlukları temizle, virgülleri kaldır
  const cleaned = priceString.replace(/[₺\s]/g, '').replace(/,/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * İçindekiler string'ini parse eder
 * "2 Çekici Hizmeti Kaza (14,000.00 TL'ye Kadar)" -> { usage_count: 2, title: "Çekici Hizmeti Kaza", limit_amount: 14000 }
 * "Hususi Taşra" -> { usage_count: 1, title: "Hususi Taşra", limit_amount: 0 }
 */
function parseCoverItem(item: string): { usage_count: number; title: string; limit_amount: number } {
  // Sayı + başlık + (limit) formatı: "2 Çekici Hizmeti Kaza (14,000.00 TL'ye Kadar)"
  const withLimitPattern = /^(\d+)\s+(.+?)\s+\(([\d,]+\.?\d*)\s+TL'ye Kadar\)$/;
  const match = item.match(withLimitPattern);

  if (match) {
    const usageCount = parseInt(match[1], 10);
    const title = match[2].trim();
    const limitString = match[3].replace(/,/g, '');
    const limitAmount = parseFloat(limitString) || 0;

    return {
      usage_count: usageCount,
      title: title,
      limit_amount: limitAmount,
    };
  }

  // Sadece başlık formatı: "Hususi Taşra"
  return {
    usage_count: 1,
    title: item.trim(),
    limit_amount: 0,
  };
}

async function importPackages() {
  console.log('🚀 Starting package import...');

  // JSON dosyasını oku
  if (!fs.existsSync(PACKAGES_JSON_PATH)) {
    console.error(`❌ JSON file not found: ${PACKAGES_JSON_PATH}`);
    process.exit(1);
  }

  const jsonContent = fs.readFileSync(PACKAGES_JSON_PATH, 'utf-8');
  const packagesData = JSON.parse(jsonContent);

  if (!Array.isArray(packagesData)) {
    console.error('❌ JSON file must contain an array of packages');
    process.exit(1);
  }

  console.log(`📦 Found ${packagesData.length} packages in JSON file`);

  // Veritabanı bağlantısını başlat
  await AppDataSource.initialize();
  console.log('✓ Database connected');

  const packageRepository = AppDataSource.getRepository(Package);
  const coverRepository = AppDataSource.getRepository(PackageCover);

  // Mevcut tüm paketleri ve kapsamlarını sil
  console.log('\n🗑️  Step 1: Deleting existing packages and covers...');
  const existingPackages = await packageRepository.find();
  if (existingPackages.length > 0) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
      await queryRunner.query('DELETE FROM `package_covers`');
      console.log(`  ✓ Deleted all existing package covers`);
      await queryRunner.query('DELETE FROM `packages`');
      console.log(`  ✓ Deleted ${existingPackages.length} existing packages`);
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      await queryRunner.release();
    }
  } else {
    console.log('  ✓ No existing packages to delete');
  }

  // Paketleri ekle
  console.log('\n📦 Step 2: Importing packages...');
  let totalPackages = 0;
  let totalCovers = 0;

  for (let i = 0; i < packagesData.length; i++) {
    const pkgData = packagesData[i];

    // Paket bilgilerini parse et
    const packageName = pkgData.paket_adi || '';
    const price = parsePrice(pkgData.fiyat || '0');
    const vehicleType = pkgData.tur || '';
    const maxVehicleAge = pkgData.yas_siniri || 40;
    const coversData = pkgData.icindekiler || [];

    // Paket oluştur
    const newPackage = packageRepository.create({
      name: packageName,
      description: undefined, // JSON'da açıklama yok, undefined bırakıyoruz
      vehicle_type: vehicleType,
      price: price,
      max_vehicle_age: maxVehicleAge,
      status: EntityStatus.ACTIVE,
    });

    const savedPackage = await packageRepository.save(newPackage);
    totalPackages++;

    // Kapsamları ekle
    let sortOrder = 0;
    for (const coverItem of coversData) {
      const parsedCover = parseCoverItem(coverItem);

      const cover = coverRepository.create({
        package_id: savedPackage.id,
        title: parsedCover.title,
        description: undefined, // JSON'da açıklama yok
        usage_count: parsedCover.usage_count,
        limit_amount: parsedCover.limit_amount,
        sort_order: sortOrder++,
      });

      await coverRepository.save(cover);
      totalCovers++;
    }

    console.log(
      `  [${i + 1}/${packagesData.length}] ✅ ${packageName} - ${vehicleType} (${coversData.length} covers)`
    );
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ IMPORT COMPLETED!');
  console.log('='.repeat(70));
  console.log(`📊 Summary:`);
  console.log(`   - Total packages imported: ${totalPackages}`);
  console.log(`   - Total covers imported: ${totalCovers}`);
  console.log(`   - Packages in database: ${await packageRepository.count()}`);
  console.log(`   - Covers in database: ${await coverRepository.count()}`);
  console.log('='.repeat(70) + '\n');

  await AppDataSource.destroy();
  console.log('✓ Database connection closed');
}

// Script'i çalıştır
importPackages().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

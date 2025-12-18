import { AppDataSource } from '../../config/database';
import { Package } from '../../entities/Package';
import { PackageCover } from '../../entities/PackageCover';
import { EntityStatus } from '../../types/enums';

/**
 * Yol Asistan Paketleri Seed Data
 * Araç türüne ve yaş sınırına göre sabit fiyatlı paketler
 */
export const seedPackages = async () => {
  const packageRepository = AppDataSource.getRepository(Package);
  const coverRepository = AppDataSource.getRepository(PackageCover);

  // ===== PAKET VERİLERİ =====
  const packages = [
    {
      name: 'Hususi Paket (T) - Ekonomik',
      description: 'Özel araçlar için ekonomik yol asistan paketi',
      vehicle_type: 'Otomobil',
      price: 840.00,
      max_vehicle_age: 40,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 12500, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 12500, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Lastik Patlaması', usage_count: 1, limit_amount: 2000, description: 'Lastik patlaması yardımı' },
        { title: 'Yakıt Bitmesi', usage_count: 1, limit_amount: 2000, description: 'Yakıt bitmesi yardımı' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 2000, description: 'Araç kurtarma hizmeti' }
      ]
    },
    {
      name: 'Hususi Paket (T) - Standart',
      description: 'Özel araçlar için standart yol asistan paketi',
      vehicle_type: 'Otomobil',
      price: 960.00,
      max_vehicle_age: 40,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 12500, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 12500, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Lastik Patlaması', usage_count: 1, limit_amount: 2000, description: 'Lastik patlaması yardımı' },
        { title: 'Yakıt Bitmesi', usage_count: 1, limit_amount: 2000, description: 'Yakıt bitmesi yardımı' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 2000, description: 'Araç kurtarma hizmeti' }
      ]
    },
    {
      name: 'Hususi Paket (T) - Premium',
      description: 'Özel araçlar için premium yol asistan paketi',
      vehicle_type: 'Otomobil',
      price: 1250.00,
      max_vehicle_age: 40,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 3, limit_amount: 15000, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 1, limit_amount: 12500, description: 'Arıza durumunda çekici hizmeti' }
      ]
    },
    {
      name: 'Plus Hususi (T)',
      description: 'Özel araçlar için genişletilmiş yol asistan paketi',
      vehicle_type: 'Otomobil',
      price: 1320.00,
      max_vehicle_age: 30,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 17500, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 17500, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Lastik Patlaması', usage_count: 1, limit_amount: 2000, description: 'Lastik patlaması yardımı' },
        { title: 'Yakıt Bitmesi', usage_count: 1, limit_amount: 2000, description: 'Yakıt bitmesi yardımı' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 3000, description: 'Araç kurtarma hizmeti' },
        { title: 'Çilingir Hizmeti', usage_count: 1, limit_amount: 3000, description: 'Anahtar/kilit sorunları için çilingir' }
      ]
    },
    {
      name: 'Ultra Paket B1',
      description: 'Premium araçlar için ultra yol asistan paketi',
      vehicle_type: 'Otomobil',
      price: 7200.00,
      max_vehicle_age: 20,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 250000, description: 'Kaza durumunda VIP çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 250000, description: 'Arıza durumunda VIP çekici hizmeti' },
        { title: 'Lastik Patlaması', usage_count: 1, limit_amount: 3000, description: 'Lastik patlaması yardımı' },
        { title: 'Yakıt Bitmesi', usage_count: 1, limit_amount: 3000, description: 'Yakıt bitmesi yardımı' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 3000, description: 'Araç kurtarma hizmeti' },
        { title: 'İkame Araç', usage_count: 1, limit_amount: 5000, description: 'Hasar durumunda ikame araç' }
      ]
    },
    {
      name: 'Hususi Oto Rent A Car',
      description: 'Kiralık araçlar için yol asistan paketi',
      vehicle_type: 'Otomobil',
      price: 1320.00,
      max_vehicle_age: 10,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 7500, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 7500, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Lastik Patlaması', usage_count: 1, limit_amount: 2000, description: 'Lastik patlaması yardımı' },
        { title: 'Yakıt Bitmesi', usage_count: 1, limit_amount: 2000, description: 'Yakıt bitmesi yardımı' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 2000, description: 'Araç kurtarma hizmeti' }
      ]
    },
    {
      name: 'Motosiklet (T)',
      description: 'Motosikletler için yol asistan paketi',
      vehicle_type: 'Motosiklet',
      price: 600.00,
      max_vehicle_age: 40,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 3000, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 3000, description: 'Arıza durumunda çekici hizmeti' }
      ]
    },
    {
      name: 'Minibüs (T) - Standart',
      description: 'Minibüsler için standart yol asistan paketi (10-17 yolcu)',
      vehicle_type: 'Minibüs',
      price: 1080.00,
      max_vehicle_age: 40,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 12500, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 12500, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Lastik Patlaması', usage_count: 1, limit_amount: 2000, description: 'Lastik patlaması yardımı' },
        { title: 'Yakıt Bitmesi', usage_count: 1, limit_amount: 2000, description: 'Yakıt bitmesi yardımı' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 2000, description: 'Araç kurtarma hizmeti' }
      ]
    },
    {
      name: 'Minibüs (T) - Premium',
      description: 'Minibüsler için premium yol asistan paketi (10-17 yolcu)',
      vehicle_type: 'Minibüs',
      price: 1560.00,
      max_vehicle_age: 40,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 12500, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 12500, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Lastik Patlaması', usage_count: 1, limit_amount: 2000, description: 'Lastik patlaması yardımı' },
        { title: 'Yakıt Bitmesi', usage_count: 1, limit_amount: 2000, description: 'Yakıt bitmesi yardımı' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 2000, description: 'Araç kurtarma hizmeti' }
      ]
    },
    {
      name: 'Midibüs (27 koltuğa kadar)',
      description: 'Midibüsler için yol asistan paketi',
      vehicle_type: 'Midibüs',
      price: 4800.00,
      max_vehicle_age: 20,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 25000, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 25000, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 10000, description: 'Araç kurtarma hizmeti' }
      ]
    },
    {
      name: 'Kamyonet (T) - Standart',
      description: 'Kamyonetler için standart yol asistan paketi (3.500 kg\'a kadar)',
      vehicle_type: 'Kamyonet',
      price: 960.00,
      max_vehicle_age: 40,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 12500, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 12500, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Lastik Patlaması', usage_count: 1, limit_amount: 2000, description: 'Lastik patlaması yardımı' },
        { title: 'Yakıt Bitmesi', usage_count: 1, limit_amount: 2000, description: 'Yakıt bitmesi yardımı' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 2000, description: 'Araç kurtarma hizmeti' }
      ]
    },
    {
      name: 'Kamyonet Plus (3.500 kg\'a kadar)',
      description: 'Kamyonetler için premium yol asistan paketi',
      vehicle_type: 'Kamyonet',
      price: 1320.00,
      max_vehicle_age: 30,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 17500, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 17500, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Lastik Patlaması', usage_count: 1, limit_amount: 2000, description: 'Lastik patlaması yardımı' },
        { title: 'Yakıt Bitmesi', usage_count: 1, limit_amount: 2000, description: 'Yakıt bitmesi yardımı' },
        { title: 'Çilingir Hizmeti', usage_count: 1, limit_amount: 3000, description: 'Anahtar/kilit sorunları için çilingir' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 3000, description: 'Araç kurtarma hizmeti' }
      ]
    },
    {
      name: 'Ultra Paket Ticari B1',
      description: 'Ticari araçlar için ultra yol asistan paketi',
      vehicle_type: 'Kamyonet',
      price: 7200.00,
      max_vehicle_age: 20,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 250000, description: 'Kaza durumunda VIP çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 250000, description: 'Arıza durumunda VIP çekici hizmeti' },
        { title: 'Lastik Patlaması', usage_count: 1, limit_amount: 3000, description: 'Lastik patlaması yardımı' },
        { title: 'Yakıt Bitmesi', usage_count: 1, limit_amount: 3000, description: 'Yakıt bitmesi yardımı' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 3000, description: 'Araç kurtarma hizmeti' }
      ]
    },
    {
      name: 'Ticari Taksi B1',
      description: 'Taksiler için yol asistan paketi',
      vehicle_type: 'Taksi',
      price: 1080.00,
      max_vehicle_age: 30,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 10000, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 10000, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Lastik Patlaması', usage_count: 1, limit_amount: 2000, description: 'Lastik patlaması yardımı' },
        { title: 'Yakıt Bitmesi', usage_count: 1, limit_amount: 2000, description: 'Yakıt bitmesi yardımı' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 2000, description: 'Araç kurtarma hizmeti' }
      ]
    },
    {
      name: 'Kamyon (Beton Pompası, Tanker, Mikser Hariç)',
      description: 'Kamyonlar için yol asistan paketi',
      vehicle_type: 'Kamyon',
      price: 4800.00,
      max_vehicle_age: 20,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 25000, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 25000, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 10000, description: 'Araç kurtarma hizmeti' }
      ]
    },
    {
      name: 'Çekici (Sadece Kupa)',
      description: 'Çekiciler için yol asistan paketi',
      vehicle_type: 'Çekici',
      price: 4800.00,
      max_vehicle_age: 20,
      covers: [
        { title: 'Çekici Hizmeti Kaza', usage_count: 2, limit_amount: 25000, description: 'Kaza durumunda çekici hizmeti' },
        { title: 'Çekici Hizmeti Arıza', usage_count: 2, limit_amount: 25000, description: 'Arıza durumunda çekici hizmeti' },
        { title: 'Kurtarma', usage_count: 1, limit_amount: 10000, description: 'Araç kurtarma hizmeti' }
      ]
    }
  ];

  console.log('📦 Paketler oluşturuluyor...');

  const createdPackages = [];

  for (const pkgData of packages) {
    const { covers, ...packageData } = pkgData;

    // Paket zaten var mı kontrol et
    let pkg = await packageRepository.findOne({
      where: { name: packageData.name },
    });

    if (!pkg) {
      // Yeni paket oluştur
      pkg = packageRepository.create({
        ...packageData,
        status: EntityStatus.ACTIVE
      });
      pkg = await packageRepository.save(pkg);
      console.log(`  ✓ Paket oluşturuldu: ${packageData.name} - ${packageData.price} TL`);

      // Kapsamları ekle
      for (let i = 0; i < covers.length; i++) {
        const coverData = covers[i];
        const cover = coverRepository.create({
          ...coverData,
          package_id: pkg.id,
          sort_order: i + 1
        });
        await coverRepository.save(cover);
      }
      console.log(`    → ${covers.length} kapsam eklendi`);
    } else {
      console.log(`  - Paket mevcut: ${packageData.name}`);
    }

    createdPackages.push(pkg);
  }

  console.log(`\n✅ Toplam ${createdPackages.length} paket hazır.`);
  return createdPackages;
};

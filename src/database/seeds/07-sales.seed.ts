import { AppDataSource } from '../../config/database';
import { Sale } from '../../entities/Sale';
import { Vehicle } from '../../entities/Vehicle';
import { Package } from '../../entities/Package';
import { Agency } from '../../entities/Agency';

/**
 * Satış Seed Data
 * Araçlara rastgele paket satışları oluşturur
 * Komisyon, acentenin komisyon oranına göre hesaplanır
 */
export const seedSales = async () => {
  const saleRepository = AppDataSource.getRepository(Sale);
  const vehicleRepository = AppDataSource.getRepository(Vehicle);
  const packageRepository = AppDataSource.getRepository(Package);
  const agencyRepository = AppDataSource.getRepository(Agency);

  // Araçları ve paketleri getir
  const vehicles = await vehicleRepository.find({
    relations: ['customer', 'agency', 'branch'],
  });

  const packages = await packageRepository.find();

  if (vehicles.length === 0 || packages.length === 0) {
    console.log('⚠ Araç veya paket bulunamadı. Önce onları seed edin.');
    return [];
  }

  console.log('💰 Satışlar oluşturuluyor...');

  const createdSales = [];
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Araçların %60'ına satış yap
  const vehiclesToSell = vehicles.slice(0, Math.floor(vehicles.length * 0.6));

  for (const vehicle of vehiclesToSell) {
    // Araç yaşını hesapla
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - vehicle.model_year;

    // Araç türüne ve yaşına uygun paketleri bul
    // Not: Yeni sistemde vehicle.usage_type yerine araç türü string olabilir
    // Şimdilik tüm paketlerden rastgele seçelim
    const matchingPackages = packages.filter(pkg => 
      pkg.max_vehicle_age >= vehicleAge && pkg.status === 'ACTIVE'
    );

    if (matchingPackages.length === 0) continue;

    // Rastgele paket seç
    const pkg = matchingPackages[Math.floor(Math.random() * matchingPackages.length)];

    // agency_id kontrolü ve acentenin komisyon oranını al
    if (!vehicle.agency_id) continue;
    const agency = await agencyRepository.findOne({ where: { id: vehicle.agency_id } });
    if (!agency) continue;

    // Komisyon KDV hariç net fiyat üzerinden: net = fiyat / 1.20, komisyon = net × oran / 100
    const priceWithVat = parseFloat(pkg.price.toString());
    const netPrice = priceWithVat / 1.20;
    const commission = (netPrice * parseFloat(agency.commission_rate.toString())) / 100;

    // Rastgele başlangıç tarihi (son 6 ay içinde)
    const randomDays = Math.floor(Math.random() * 180);
    const startDate = new Date(sixMonthsAgo);
    startDate.setDate(startDate.getDate() + randomDays);

    // Bitiş tarihi (başlangıçtan 1 yıl sonra)
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    const saleData = {
      customer_id: vehicle.customer_id,
      vehicle_id: vehicle.id,
      agency_id: vehicle.agency_id,
      branch_id: vehicle.branch_id,
      user_id: vehicle.customer?.created_by,
      package_id: pkg.id,
      price: pkg.price,
      commission: commission,
      start_date: startDate,
      end_date: endDate,
      policy_number: `POL-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    };

    const sale = saleRepository.create(saleData);
    const saved = await saleRepository.save(sale);
    createdSales.push(saved);
    console.log(`  ✓ Satış: ${saleData.policy_number} - ${pkg.name} (${pkg.price} TL, %${agency.commission_rate} komisyon)`);
  }

  console.log(`\n✅ Toplam ${createdSales.length} satış oluşturuldu.`);
  return createdSales;
};

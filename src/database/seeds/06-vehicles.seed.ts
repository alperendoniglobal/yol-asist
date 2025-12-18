import { AppDataSource } from '../../config/database';
import { Vehicle } from '../../entities/Vehicle';
import { Customer } from '../../entities/Customer';
import { CarBrand } from '../../entities/CarBrand';
import { CarModel } from '../../entities/CarModel';
import { UsageType } from '../../types/enums';

/**
 * Vehicle seed - Araç verilerini oluşturur
 * Brand ve model ID'leri veritabanından dinamik olarak çekilir
 */
export const seedVehicles = async () => {
  const vehicleRepository = AppDataSource.getRepository(Vehicle);
  const customerRepository = AppDataSource.getRepository(Customer);
  const brandRepository = AppDataSource.getRepository(CarBrand);
  const modelRepository = AppDataSource.getRepository(CarModel);

  // Mevcut müşterileri çek
  const customers = await customerRepository.find({
    relations: ['agency', 'branch'],
  });

  if (customers.length === 0) {
    console.log('⚠ No customers found. Please seed customers first.');
    return [];
  }

  // Veritabanından mevcut brand'leri çek
  const brands = await brandRepository.find({
    order: { id: 'ASC' },
    take: 10, // İlk 10 brand yeterli
  });

  if (brands.length === 0) {
    console.log('⚠ No car brands found. Please seed car brands first.');
    return [];
  }

  // Her brand için model'leri çek
  const brandModels: Map<number, number[]> = new Map();
  for (const brand of brands) {
    const models = await modelRepository.find({
      where: { brand_id: brand.id },
      take: 5, // Her brand'den max 5 model
    });
    if (models.length > 0) {
      brandModels.set(brand.id, models.map(m => m.id));
    }
  }

  // Eğer hiç model yoksa, brand_id ve model_id null olarak bırak
  const hasBrandsWithModels = brandModels.size > 0;

  // Helper function: Rastgele brand ve model seç
  const getRandomBrandModel = () => {
    if (!hasBrandsWithModels) {
      return { brand_id: null, model_id: null };
    }
    const brandIds = Array.from(brandModels.keys());
    const randomBrandId = brandIds[Math.floor(Math.random() * brandIds.length)];
    const modelIds = brandModels.get(randomBrandId) || [];
    const randomModelId = modelIds.length > 0 
      ? modelIds[Math.floor(Math.random() * modelIds.length)] 
      : null;
    return { brand_id: randomBrandId, model_id: randomModelId };
  };

  // Araç verisi tanımlamaları - brand/model dinamik olarak atanacak
  const vehiclesData = [
    // Hususi (Private) araçlar
    { plate: '34ABC123', model_year: 2023, usage_type: UsageType.PRIVATE },
    { plate: '34DEF456', model_year: 2022, usage_type: UsageType.PRIVATE },
    { plate: '06GHI789', model_year: 2024, usage_type: UsageType.PRIVATE },
    { plate: '06JKL012', model_year: 2021, usage_type: UsageType.PRIVATE },
    { plate: '07MNO345', model_year: 2023, usage_type: UsageType.PRIVATE },
    { plate: '07PQR678', model_year: 2022, usage_type: UsageType.PRIVATE },
    { plate: '35STU901', model_year: 2024, usage_type: UsageType.PRIVATE },
    { plate: '35VWX234', model_year: 2023, usage_type: UsageType.PRIVATE },
    { plate: '16YZA567', model_year: 2022, usage_type: UsageType.PRIVATE },
    { plate: '16BCD890', model_year: 2021, usage_type: UsageType.PRIVATE },
    // Ticari (Commercial) araçlar
    { plate: '34TIC123', model_year: 2020, usage_type: UsageType.COMMERCIAL },
    { plate: '34TIC456', model_year: 2021, usage_type: UsageType.COMMERCIAL },
    { plate: '06TIC789', model_year: 2022, usage_type: UsageType.COMMERCIAL },
    { plate: '06TIC012', model_year: 2023, usage_type: UsageType.COMMERCIAL },
    { plate: '07TIC345', model_year: 2021, usage_type: UsageType.COMMERCIAL },
    { plate: '07TIC678', model_year: 2020, usage_type: UsageType.COMMERCIAL },
    { plate: '35TIC901', model_year: 2022, usage_type: UsageType.COMMERCIAL },
    { plate: '35TIC234', model_year: 2023, usage_type: UsageType.COMMERCIAL },
    { plate: '16TIC567', model_year: 2021, usage_type: UsageType.COMMERCIAL },
    { plate: '16TIC890', model_year: 2020, usage_type: UsageType.COMMERCIAL },
    // Taksi araçları
    { plate: '34TAK123', model_year: 2022, usage_type: UsageType.TAXI },
    { plate: '34TAK456', model_year: 2023, usage_type: UsageType.TAXI },
    { plate: '06TAK789', model_year: 2021, usage_type: UsageType.TAXI },
    { plate: '06TAK012', model_year: 2022, usage_type: UsageType.TAXI },
    { plate: '07TAK345', model_year: 2023, usage_type: UsageType.TAXI },
    { plate: '07TAK678', model_year: 2021, usage_type: UsageType.TAXI },
    { plate: '35TAK901', model_year: 2022, usage_type: UsageType.TAXI },
    { plate: '35TAK234', model_year: 2023, usage_type: UsageType.TAXI },
    { plate: '16TAK567', model_year: 2021, usage_type: UsageType.TAXI },
    { plate: '16TAK890', model_year: 2022, usage_type: UsageType.TAXI },
  ];

  const createdVehicles = [];

  for (let i = 0; i < vehiclesData.length && i < customers.length; i++) {
    const vehicleData = vehiclesData[i];
    const customer = customers[i];

    // Mevcut araç kontrolü
    const existing = await vehicleRepository.findOne({
      where: { plate: vehicleData.plate },
    });

    if (!existing) {
      // Rastgele brand ve model ata
      const { brand_id, model_id } = getRandomBrandModel();

      const vehicle = vehicleRepository.create({
        ...vehicleData,
        brand_id,
        model_id,
        customer_id: customer.id,
        agency_id: customer.agency_id,
        branch_id: customer.branch_id,
      });
      const saved = await vehicleRepository.save(vehicle);
      createdVehicles.push(saved);
      console.log(`✓ Vehicle created: ${vehicleData.plate} (Brand: ${brand_id || 'N/A'}, Model: ${model_id || 'N/A'})`);
    } else {
      createdVehicles.push(existing);
      console.log(`- Vehicle exists: ${vehicleData.plate}`);
    }
  }

  console.log(`\n✅ Toplam ${createdVehicles.length} araç hazır.`);
  return createdVehicles;
};

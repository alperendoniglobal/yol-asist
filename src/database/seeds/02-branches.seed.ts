import { AppDataSource } from '../../config/database';
import { Branch } from '../../entities/Branch';
import { Agency } from '../../entities/Agency';
import { EntityStatus } from '../../types/enums';

export const seedBranches = async () => {
  const branchRepository = AppDataSource.getRepository(Branch);
  const agencyRepository = AppDataSource.getRepository(Agency);

  const agencies = await agencyRepository.find();

  if (agencies.length === 0) {
    console.log('⚠ No agencies found. Please seed agencies first.');
    return [];
  }

  // Şube verileri - her şubenin komisyon oranı ZORUNLU
  // Komisyon oranı acente oranından fazla OLAMAZ
  const branchesData = [
    // Anadolu Sigorta branches (acente komisyonu varsayılan %20-25 arası)
    {
      name: 'Kadıköy Şubesi',
      address: 'Caferağa Mah. Moda Cad. No:45 Kadıköy/İstanbul',
      phone: '0216 336 7890',
      status: EntityStatus.ACTIVE,
      commission_rate: 18, // %18 komisyon
      balance: 0,
    },
    {
      name: 'Beşiktaş Şubesi',
      address: 'Barbaros Bulvarı No:112 Beşiktaş/İstanbul',
      phone: '0212 227 8945',
      status: EntityStatus.ACTIVE,
      commission_rate: 15, // %15 komisyon
      balance: 0,
    },
    // Güven Sigorta branches
    {
      name: 'Çankaya Merkez',
      address: 'Kızılay Cad. No:67 Çankaya/Ankara',
      phone: '0312 418 9012',
      status: EntityStatus.ACTIVE,
      commission_rate: 20, // %20 komisyon
      balance: 0,
    },
    {
      name: 'Keçiören Şubesi',
      address: 'Atatürk Bulvarı No:234 Keçiören/Ankara',
      phone: '0312 368 5432',
      status: EntityStatus.ACTIVE,
      commission_rate: 17, // %17 komisyon
      balance: 0,
    },
    // Akdeniz Sigorta branches
    {
      name: 'Muratpaşa Merkez',
      address: 'Lara Cad. No:89 Muratpaşa/Antalya',
      phone: '0242 323 7654',
      status: EntityStatus.ACTIVE,
      commission_rate: 19, // %19 komisyon
      balance: 0,
    },
    {
      name: 'Kepez Şubesi',
      address: 'Atatürk Bulvarı No:156 Kepez/Antalya',
      phone: '0242 229 8765',
      status: EntityStatus.ACTIVE,
      commission_rate: 16, // %16 komisyon
      balance: 0,
    },
    // Marmara Sigorta branches
    {
      name: 'Konak Merkez',
      address: 'Cumhuriyet Bulvarı No:203 Konak/İzmir',
      phone: '0232 445 6789',
      status: EntityStatus.ACTIVE,
      commission_rate: 18, // %18 komisyon
      balance: 0,
    },
    {
      name: 'Karşıyaka Şubesi',
      address: 'Atatürk Cad. No:178 Karşıyaka/İzmir',
      phone: '0232 369 4321',
      status: EntityStatus.ACTIVE,
      commission_rate: 15, // %15 komisyon
      balance: 0,
    },
    // Ege Sigorta branches
    {
      name: 'Nilüfer Merkez',
      address: 'Atatürk Cad. No:95 Nilüfer/Bursa',
      phone: '0224 443 2109',
      status: EntityStatus.ACTIVE,
      commission_rate: 20, // %20 komisyon
      balance: 0,
    },
    {
      name: 'Osmangazi Şubesi',
      address: 'Ankara Yolu No:45 Osmangazi/Bursa',
      phone: '0224 220 8765',
      status: EntityStatus.ACTIVE,
      commission_rate: 17, // %17 komisyon
      balance: 0,
    },
  ];

  const createdBranches = [];
  let agencyIndex = 0;

  for (let i = 0; i < branchesData.length; i++) {
    const branchData = branchesData[i];
    const agency = agencies[agencyIndex];

    const existing = await branchRepository.findOne({
      where: { name: branchData.name, agency_id: agency.id },
    });

    if (!existing) {
      const branch = branchRepository.create({
        ...branchData,
        agency_id: agency.id,
      });
      const saved = await branchRepository.save(branch);
      createdBranches.push(saved);
      console.log(`✓ Branch created: ${branchData.name} (${agency.name})`);
    } else {
      createdBranches.push(existing);
      console.log(`- Branch exists: ${branchData.name}`);
    }

    // 2 branches per agency
    if ((i + 1) % 2 === 0) {
      agencyIndex++;
    }
  }

  return createdBranches;
};

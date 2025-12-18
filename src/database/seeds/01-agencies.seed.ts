import { AppDataSource } from '../../config/database';
import { Agency } from '../../entities/Agency';
import { EntityStatus } from '../../types/enums';

/**
 * Acente Seed Data
 * Her acentenin kendine özel komisyon oranı vardır
 */
export const seedAgencies = async () => {
  const agencyRepository = AppDataSource.getRepository(Agency);

  const agencies = [
    {
      name: 'Anadolu Sigorta Acentesi',
      tax_number: '1234567890',
      address: 'Atatürk Cad. No:123, Çankaya/Ankara',
      phone: '0312 111 2222',
      email: 'info@anadolusigorta.com',
      commission_rate: 25.00, // %25 komisyon
      status: EntityStatus.ACTIVE,
      balance: 150000,
    },
    {
      name: 'Güven Sigorta',
      tax_number: '2345678901',
      address: 'İstiklal Cad. No:456, Beyoğlu/İstanbul',
      phone: '0212 222 3333',
      email: 'info@guvensigorta.com',
      commission_rate: 22.50, // %22.5 komisyon
      status: EntityStatus.ACTIVE,
      balance: 85000,
    },
    {
      name: 'Akdeniz Sigorta Hizmetleri',
      tax_number: '3456789012',
      address: 'Konyaaltı Cad. No:789, Konyaaltı/Antalya',
      phone: '0242 333 4444',
      email: 'info@akdenizsigorta.com',
      commission_rate: 20.00, // %20 komisyon
      status: EntityStatus.ACTIVE,
      balance: 120000,
    },
    {
      name: 'Marmara Sigorta Acentesi',
      tax_number: '4567890123',
      address: 'Bursa Cad. No:321, Nilüfer/Bursa',
      phone: '0224 444 5555',
      email: 'info@marmarasigorta.com',
      commission_rate: 18.00, // %18 komisyon
      status: EntityStatus.ACTIVE,
      balance: 95000,
    },
    {
      name: 'Ege Sigorta',
      tax_number: '5678901234',
      address: 'Kordon Cad. No:654, Konak/İzmir',
      phone: '0232 555 6666',
      email: 'info@egesigorta.com',
      commission_rate: 30.00, // %30 komisyon (Premium acente)
      status: EntityStatus.ACTIVE,
      balance: 110000,
    },
  ];

  console.log('🏢 Acenteler oluşturuluyor...');

  const createdAgencies = [];
  for (const agencyData of agencies) {
    const existing = await agencyRepository.findOne({
      where: { name: agencyData.name },
    });

    if (!existing) {
      const agency = agencyRepository.create(agencyData);
      const saved = await agencyRepository.save(agency);
      createdAgencies.push(saved);
      console.log(`  ✓ Acente oluşturuldu: ${agencyData.name} (%${agencyData.commission_rate} komisyon)`);
    } else {
      // Mevcut acentenin komisyon oranını güncelle
      existing.commission_rate = agencyData.commission_rate;
      existing.tax_number = agencyData.tax_number;
      existing.address = agencyData.address;
      existing.phone = agencyData.phone;
      existing.email = agencyData.email;
      await agencyRepository.save(existing);
      createdAgencies.push(existing);
      console.log(`  - Acente mevcut (güncellendi): ${agencyData.name} (%${agencyData.commission_rate} komisyon)`);
    }
  }

  console.log(`\n✅ Toplam ${createdAgencies.length} acente hazır.`);
  return createdAgencies;
};

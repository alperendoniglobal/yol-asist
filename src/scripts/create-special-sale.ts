import 'reflect-metadata';
import dotenv from 'dotenv';
import * as path from 'path';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Customer } from '../entities/Customer';
import { Vehicle } from '../entities/Vehicle';
import { Sale } from '../entities/Sale';
import { Package } from '../entities/Package';
import { Agency } from '../entities/Agency';
import { Branch } from '../entities/Branch';
import { UsageType } from '../types/enums';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SPECIAL_SALE_DATA = {
  sellerUserId: 'd6fdc7d9-8229-429f-8890-985404ac1902',
  packageId: 'fd4d5f4b-49c3-4afe-8e02-042b3f4ece9a',
  customer: {
    is_corporate: true,
    tc_vkn: '7342812039',
    name: 'REK OTOMATIV ve INSSAT SANAYI',
    surname: undefined,
    tax_office: undefined,
    birth_date: new Date('1990-12-20'),
    phone: '5415923031',
    email: undefined,
    city: 'Tekirdag',
    district: 'Cerkezkoy',
    address: undefined,
  },
  vehicle: {
    plate: '34MLH803',
    brand_id: 52,
    model_id: 850001005,
    model_year: 2024,
    usage_type: UsageType.PRIVATE,
    vehicle_type: 'Otomobil',
    is_foreign_plate: false,
  },
};

function getDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function generatePolicyNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

function getNetPrice(priceWithVat: number): number {
  return priceWithVat / 1.2;
}

async function calculateDistributedCommission(
  price: number,
  branchId: string | null,
  agencyId: string | null,
  queryRunner: any
): Promise<{ branch_commission: number | null; agency_commission: number | null; total_commission: number }> {
  const netPrice = getNetPrice(price);

  if (branchId) {
    const branch = await queryRunner.manager.findOne(Branch, { where: { id: branchId } });
    if (!branch) {
      throw new Error('Sube bulunamadi');
    }

    if (!branch.agency_id) {
      throw new Error('Sube bir acenteye bagli degil');
    }

    const agency = await queryRunner.manager.findOne(Agency, { where: { id: branch.agency_id } });
    if (!agency) {
      throw new Error('Acente bulunamadi');
    }

    const branchRate = Number(branch.commission_rate);
    const agencyRate = Number(agency.commission_rate);

    if (branchRate > agencyRate) {
      throw new Error(`Sube komisyonu (${branchRate}%) acente komisyonundan (${agencyRate}%) yuksek olamaz`);
    }

    const branchCommission = (netPrice * branchRate) / 100;
    const agencyCommission = (netPrice * (agencyRate - branchRate)) / 100;
    const totalCommission = (netPrice * agencyRate) / 100;

    return {
      branch_commission: branchCommission,
      agency_commission: agencyCommission,
      total_commission: totalCommission,
    };
  }

  if (agencyId) {
    const agency = await queryRunner.manager.findOne(Agency, { where: { id: agencyId } });
    if (!agency) {
      throw new Error('Acente bulunamadi');
    }

    const agencyRate = Number(agency.commission_rate);
    const agencyCommission = (netPrice * agencyRate) / 100;

    return {
      branch_commission: null,
      agency_commission: agencyCommission,
      total_commission: agencyCommission,
    };
  }

  const defaultRate = 20;
  const defaultCommission = (netPrice * defaultRate) / 100;
  return {
    branch_commission: null,
    agency_commission: defaultCommission,
    total_commission: defaultCommission,
  };
}

async function createSpecialSale() {
  console.log('Ozel satis scripti basliyor...');

  await AppDataSource.initialize();
  console.log('Veritabani baglantisi acildi.');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const user = await queryRunner.manager.findOne(User, {
      where: { id: SPECIAL_SALE_DATA.sellerUserId },
    });

    if (!user) {
      throw new Error(`Satis yapan kullanici bulunamadi: ${SPECIAL_SALE_DATA.sellerUserId}`);
    }

    const agencyId = user.agency_id || null;
    const branchId = user.branch_id || null;

    if (!agencyId) {
      throw new Error('Satis yapan kullanicinin agency_id bilgisi yok');
    }

    const pkg = await queryRunner.manager.findOne(Package, {
      where: { id: SPECIAL_SALE_DATA.packageId },
    });

    if (!pkg) {
      throw new Error(`Paket bulunamadi: ${SPECIAL_SALE_DATA.packageId}`);
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);

    let customer = await queryRunner.manager.findOne(Customer, {
      where: { tc_vkn: SPECIAL_SALE_DATA.customer.tc_vkn },
    });

    if (customer) {
      Object.assign(customer, {
        is_corporate: true,
        tc_vkn: SPECIAL_SALE_DATA.customer.tc_vkn,
        name: SPECIAL_SALE_DATA.customer.name,
        surname: SPECIAL_SALE_DATA.customer.surname as any,
        tax_office: SPECIAL_SALE_DATA.customer.tax_office as any,
        birth_date: SPECIAL_SALE_DATA.customer.birth_date as any,
        phone: SPECIAL_SALE_DATA.customer.phone,
        email: SPECIAL_SALE_DATA.customer.email as any,
        city: SPECIAL_SALE_DATA.customer.city,
        district: SPECIAL_SALE_DATA.customer.district,
        address: SPECIAL_SALE_DATA.customer.address as any,
        agency_id: agencyId,
        branch_id: branchId,
        created_by: user.id,
      });
      customer = await queryRunner.manager.save(customer);
      console.log(`Musteri guncellendi: ${customer.id}`);
    } else {
      const created = queryRunner.manager.create(Customer, {
        ...SPECIAL_SALE_DATA.customer,
        agency_id: agencyId,
        branch_id: branchId,
        created_by: user.id,
      });
      customer = await queryRunner.manager.save(created);
      console.log(`Musteri olusturuldu: ${customer.id}`);
    }

    const normalizedPlate = SPECIAL_SALE_DATA.vehicle.plate.toUpperCase();
    let vehicle = await queryRunner.manager.findOne(Vehicle, {
      where: { plate: normalizedPlate },
    });

    if (vehicle) {
      Object.assign(vehicle, {
        customer_id: customer.id,
        agency_id: agencyId,
        branch_id: branchId,
        plate: normalizedPlate,
        brand_id: SPECIAL_SALE_DATA.vehicle.brand_id,
        model_id: SPECIAL_SALE_DATA.vehicle.model_id,
        model_year: SPECIAL_SALE_DATA.vehicle.model_year,
        usage_type: SPECIAL_SALE_DATA.vehicle.usage_type,
        vehicle_type: SPECIAL_SALE_DATA.vehicle.vehicle_type,
        is_foreign_plate: SPECIAL_SALE_DATA.vehicle.is_foreign_plate,
        motor_brand_id: null,
        motor_model_id: null,
      });
      vehicle = await queryRunner.manager.save(vehicle);
      console.log(`Arac guncellendi: ${vehicle.id}`);
    } else {
      const created = queryRunner.manager.create(Vehicle, {
        customer_id: customer.id,
        agency_id: agencyId,
        branch_id: branchId,
        plate: normalizedPlate,
        brand_id: SPECIAL_SALE_DATA.vehicle.brand_id,
        model_id: SPECIAL_SALE_DATA.vehicle.model_id,
        model_year: SPECIAL_SALE_DATA.vehicle.model_year,
        usage_type: SPECIAL_SALE_DATA.vehicle.usage_type,
        vehicle_type: SPECIAL_SALE_DATA.vehicle.vehicle_type,
        is_foreign_plate: SPECIAL_SALE_DATA.vehicle.is_foreign_plate,
      });
      vehicle = await queryRunner.manager.save(created);
      console.log(`Arac olusturuldu: ${vehicle.id}`);
    }

    const startDateOnly = getDateOnly(today);
    const existingSale = await queryRunner.manager
      .createQueryBuilder(Sale, 'sale')
      .where('sale.vehicle_id = :vehicleId', { vehicleId: vehicle.id })
      .andWhere('sale.package_id = :packageId', { packageId: pkg.id })
      .andWhere('DATE(sale.start_date) = :startDate', { startDate: startDateOnly })
      .getOne();

    if (existingSale) {
      await queryRunner.commitTransaction();
      console.log('Ayni arac + paket + baslangic tarihi icin satis zaten mevcut.');
      console.log(
        JSON.stringify(
          {
            customer_id: customer.id,
            vehicle_id: vehicle.id,
            sale_id: existingSale.id,
            policy_number: existingSale.policy_number,
            is_existing_sale: true,
          },
          null,
          2
        )
      );
      return;
    }

    const price = Number(pkg.price);
    const distributed = await calculateDistributedCommission(price, branchId, agencyId, queryRunner);

    const sale = queryRunner.manager.create(Sale, {
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      agency_id: agencyId,
      branch_id: branchId,
      user_id: user.id,
      package_id: pkg.id,
      price,
      commission: distributed.total_commission,
      branch_commission: distributed.branch_commission,
      agency_commission: distributed.agency_commission,
      start_date: today,
      end_date: endDate,
      policy_number: generatePolicyNumber(),
    });

    const savedSale = await queryRunner.manager.save(sale);
    await queryRunner.commitTransaction();

    console.log('Ozel satis basariyla olusturuldu.');
    console.log(
      JSON.stringify(
        {
          customer_id: customer.id,
          vehicle_id: vehicle.id,
          sale_id: savedSale.id,
          policy_number: savedSale.policy_number,
          is_existing_sale: false,
        },
        null,
        2
      )
    );
  } catch (error: any) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    console.error('Script hatasi:', error.message || error);
    process.exitCode = 1;
  } finally {
    if (!queryRunner.isReleased) {
      await queryRunner.release();
    }
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    console.log('Veritabani baglantisi kapatildi.');
  }
}

createSpecialSale().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

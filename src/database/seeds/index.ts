import 'reflect-metadata';
import { AppDataSource } from '../../config/database';
import { seedCarBrands } from './00-car-brands.seed';
import { seedCarModels } from './01-car-models.seed';
import { seedAgencies } from './01-agencies.seed';
import { seedBranches } from './02-branches.seed';
import { seedUsers } from './03-users.seed';
import { seedPackages } from './04-packages.seed';
import { seedCustomers } from './05-customers.seed';
import { seedVehicles } from './06-vehicles.seed';
import { seedSales } from './07-sales.seed';
import { seedPayments } from './08-payments.seed';

async function runSeeds() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('✓ Database connection established\n');

    // Run seeds in order
    console.log('🚗 Seeding Car Brands...');
    await seedCarBrands();
    console.log('');

    console.log('🚙 Seeding Car Models...');
    await seedCarModels();
    console.log('');

    console.log('📦 Seeding Agencies...');
    await seedAgencies();
    console.log('');

    console.log('🏢 Seeding Branches...');
    await seedBranches();
    console.log('');

    console.log('👥 Seeding Users...');
    await seedUsers();
    console.log('');

    console.log('📋 Seeding Packages...');
    await seedPackages();
    console.log('');

    console.log('👤 Seeding Customers...');
    await seedCustomers();
    console.log('');

    console.log('🚗 Seeding Vehicles...');
    await seedVehicles();
    console.log('');

    console.log('💰 Seeding Sales...');
    await seedSales();
    console.log('');

    console.log('💳 Seeding Payments...');
    await seedPayments();
    console.log('');

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('--------------------------------------------------');
    console.log('✓ Agencies: 5');
    console.log('✓ Branches: 10 (2 per agency)');
    console.log('✓ Users: 35+ (1 Super Admin, 5 Agency Admins, 10 Branch Admins, 20 Branch Users)');
    console.log('✓ Packages: 5 (with prices and covers)');
    console.log('✓ Customers: 30');
    console.log('✓ Vehicles: 30');
    console.log('✓ Sales: ~18 (60% of vehicles)');
    console.log('✓ Payments: ~14 (80% of sales)');
    console.log('--------------------------------------------------\n');

    console.log('🔐 Login Credentials:');
    console.log('--------------------------------------------------');
    console.log('Super Admin:');
    console.log('  Email: admin@yolasistan.com');
    console.log('  Password: Admin123!');
    console.log('');
    console.log('Agency Admin (example):');
    console.log('  Email: ahmet.yilmaz@anadolu.com');
    console.log('  Password: Admin123!');
    console.log('');
    console.log('Branch Admin (example):');
    console.log('  Email: fatma.ozturk@anadolu.com');
    console.log('  Password: Admin123!');
    console.log('');
    console.log('Branch User (example):');
    console.log('  Email: can.yilmaz@anadolu.com');
    console.log('  Password: User123!');
    console.log('--------------------------------------------------\n');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await AppDataSource.destroy();
    console.log('✓ Database connection closed');
  }
}

// Run seeds
runSeeds();

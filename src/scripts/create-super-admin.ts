import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { UserRole, EntityStatus } from '../types/enums';
import { hashPassword } from '../utils/hash';

/**
 * Süper Admin Oluşturma Script'i
 * admin@yolasistan.com / Admin123! kullanıcısını oluşturur
 */

async function createSuperAdmin() {
  console.log('🚀 Starting super admin creation...\n');

  // Veritabanı bağlantısını başlat
  await AppDataSource.initialize();
  console.log('✓ Database connected\n');

  const userRepository = AppDataSource.getRepository(User);

  // Mevcut kullanıcıyı kontrol et
  const existingUser = await userRepository.findOne({
    where: { email: 'admin@yolasistan.com' },
  });

  if (existingUser) {
    console.log('⚠️  User with email admin@yolasistan.com already exists!');
    console.log(`   ID: ${existingUser.id}`);
    console.log(`   Role: ${existingUser.role}`);
    console.log(`   Status: ${existingUser.status}`);
    console.log('\n❌ Super admin already exists. Exiting...\n');
    await AppDataSource.destroy();
    process.exit(0);
  }

  // Şifreyi hashle
  const password = 'Admin123!';
  const hashedPassword = await hashPassword(password);

  // Süper admin kullanıcısını oluştur
  const superAdminData: Partial<User> = {
    name: 'Admin',
    surname: 'User',
    email: 'admin@yolasistan.com',
    phone: undefined, // Telefon opsiyonel
    password: hashedPassword,
    plain_password: password, // Plain text şifreyi sakla (SADECE SUPER_ADMIN için gösterilecek)
    role: UserRole.SUPER_ADMIN,
    status: EntityStatus.ACTIVE,
    agency_id: undefined as any, // SUPER_ADMIN için agency_id null olabilir
    branch_id: undefined as any, // SUPER_ADMIN için branch_id null olabilir
    is_deleted: false,
    deleted_at: undefined,
    permissions: undefined, // İhtiyaç halinde özel izinler eklenebilir
  };
  
  const superAdmin = userRepository.create(superAdminData);

  await userRepository.save(superAdmin);

  console.log('✅ Super admin created successfully!');
  console.log('='.repeat(70));
  console.log('📊 Super Admin Details:');
  console.log(`   - ID: ${superAdmin.id}`);
  console.log(`   - Name: ${superAdmin.name} ${superAdmin.surname}`);
  console.log(`   - Email: ${superAdmin.email}`);
  console.log(`   - Role: ${superAdmin.role}`);
  console.log(`   - Status: ${superAdmin.status}`);
  console.log(`   - Password: ${password} (plain text - stored securely)`);
  console.log('='.repeat(70));
  console.log('\n✅ You can now login with:');
  console.log(`   Email: admin@yolasistan.com`);
  console.log(`   Password: Admin123!`);
  console.log('\n');

  await AppDataSource.destroy();
  console.log('✓ Database connection closed');
}

// Script'i çalıştır
createSuperAdmin().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

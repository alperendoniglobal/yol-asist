import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Make phone unique in users and user_customers tables
 * Telefon numarasını users ve user_customers tablolarında unique yapar
 * SMS gönderimi için kritik - her kullanıcının benzersiz telefon numarası olmalı
 */
export class MakePhoneUnique1702200000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. users tablosunda duplicate telefon numaralarını kontrol et ve temizle
    console.log('🔍 users tablosunda duplicate telefon numaraları kontrol ediliyor...');
    const duplicateUsers = await queryRunner.query(`
      SELECT phone, COUNT(*) as count
      FROM users
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone
      HAVING count > 1
    `);

    if (duplicateUsers.length > 0) {
      console.warn(`⚠️ ${duplicateUsers.length} duplicate telefon numarası bulundu:`);
      for (const dup of duplicateUsers) {
        console.warn(`  - ${dup.phone}: ${dup.count} kullanıcı`);
        // En eski kayıt dışındakilerin telefon numarasını null yap
        await queryRunner.query(`
          UPDATE users
          SET phone = NULL
          WHERE phone = ?
            AND id NOT IN (
              SELECT id FROM (
                SELECT id FROM users
                WHERE phone = ?
                ORDER BY created_at ASC
                LIMIT 1
              ) AS temp
            )
        `, [dup.phone, dup.phone]);
        console.log(`  ✅ Duplicate telefon numaraları temizlendi: ${dup.phone}`);
      }
    } else {
      console.log('✅ users tablosunda duplicate telefon numarası yok');
    }

    // 2. user_customers tablosunda duplicate telefon numaralarını kontrol et ve temizle
    console.log('🔍 user_customers tablosunda duplicate telefon numaraları kontrol ediliyor...');
    const duplicateUserCustomers = await queryRunner.query(`
      SELECT phone, COUNT(*) as count
      FROM user_customers
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone
      HAVING count > 1
    `);

    if (duplicateUserCustomers.length > 0) {
      console.warn(`⚠️ ${duplicateUserCustomers.length} duplicate telefon numarası bulundu:`);
      for (const dup of duplicateUserCustomers) {
        console.warn(`  - ${dup.phone}: ${dup.count} kullanıcı`);
        // En eski kayıt dışındakilerin telefon numarasını null yap (ama phone NOT NULL, o yüzden hata verebilir)
        // Bu durumda en eski kayıt dışındakilere unique bir telefon numarası ekleyelim
        const users = await queryRunner.query(`
          SELECT id FROM user_customers
          WHERE phone = ?
          ORDER BY created_at ASC
        `, [dup.phone]);

        for (let i = 1; i < users.length; i++) {
          // Duplicate telefon numarasına timestamp ekle
          const newPhone = `${dup.phone}_${Date.now()}_${i}`;
          await queryRunner.query(`
            UPDATE user_customers
            SET phone = ?
            WHERE id = ?
          `, [newPhone, users[i].id]);
          console.log(`  ✅ Duplicate telefon numarası güncellendi: ${users[i].id} -> ${newPhone}`);
        }
      }
    } else {
      console.log('✅ user_customers tablosunda duplicate telefon numarası yok');
    }

    // 3. users tablosunda phone kolonuna unique constraint ekle
    console.log('🔧 users tablosunda phone kolonuna unique constraint ekleniyor...');
    
    // Önce mevcut unique constraint'i kontrol et
    const existingIndexUsers = await queryRunner.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND CONSTRAINT_TYPE = 'UNIQUE'
        AND CONSTRAINT_NAME LIKE '%phone%'
    `);

    if (existingIndexUsers.length === 0) {
      await queryRunner.query(`
        ALTER TABLE users
        ADD UNIQUE INDEX idx_users_phone_unique (phone)
      `);
      console.log('✅ users.phone unique constraint eklendi');
    } else {
      console.log('⚠️ users.phone unique constraint zaten mevcut, atlandı');
    }

    // 4. user_customers tablosunda phone kolonuna unique constraint ekle
    console.log('🔧 user_customers tablosunda phone kolonuna unique constraint ekleniyor...');
    
    // Önce mevcut unique constraint'i kontrol et
    const existingIndexUserCustomers = await queryRunner.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'user_customers'
        AND CONSTRAINT_TYPE = 'UNIQUE'
        AND CONSTRAINT_NAME LIKE '%phone%'
    `);

    if (existingIndexUserCustomers.length === 0) {
      await queryRunner.query(`
        ALTER TABLE user_customers
        ADD UNIQUE INDEX idx_user_customers_phone_unique (phone)
      `);
      console.log('✅ user_customers.phone unique constraint eklendi');
    } else {
      console.log('⚠️ user_customers.phone unique constraint zaten mevcut, atlandı');
    }

    console.log('✅ Telefon numarası unique constraint\'leri başarıyla eklendi');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Unique constraint'leri kaldır
    console.log('⬇️ Telefon numarası unique constraint\'leri kaldırılıyor...');

    // users tablosundan unique constraint'i kaldır
    const indexUsers = await queryRunner.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND CONSTRAINT_TYPE = 'UNIQUE'
        AND CONSTRAINT_NAME LIKE '%phone%'
    `);

    if (indexUsers.length > 0) {
      for (const idx of indexUsers) {
        await queryRunner.query(`
          ALTER TABLE users
          DROP INDEX ${idx.CONSTRAINT_NAME}
        `);
        console.log(`✅ users.phone unique constraint kaldırıldı: ${idx.CONSTRAINT_NAME}`);
      }
    }

    // user_customers tablosundan unique constraint'i kaldır
    const indexUserCustomers = await queryRunner.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'user_customers'
        AND CONSTRAINT_TYPE = 'UNIQUE'
        AND CONSTRAINT_NAME LIKE '%phone%'
    `);

    if (indexUserCustomers.length > 0) {
      for (const idx of indexUserCustomers) {
        await queryRunner.query(`
          ALTER TABLE user_customers
          DROP INDEX ${idx.CONSTRAINT_NAME}
        `);
        console.log(`✅ user_customers.phone unique constraint kaldırıldı: ${idx.CONSTRAINT_NAME}`);
      }
    }

    console.log('⬇️ Telefon numarası unique constraint\'leri kaldırıldı');
  }
}


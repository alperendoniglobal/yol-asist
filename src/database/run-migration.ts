/**
 * Veritabanina is_deleted ve deleted_at kolonlarini ekleyen script
 * Calistirmak icin: npx ts-node src/database/run-migration.ts
 */
import { AppDataSource } from '../config/database';

async function runMigration() {
  try {
    // Veritabani baglantisiniyap
    await AppDataSource.initialize();
    console.log('Veritabani baglantisi kuruldu');

    const queryRunner = AppDataSource.createQueryRunner();

    // Kolon var mi kontrol et
    const columns = await queryRunner.query(`SHOW COLUMNS FROM users LIKE 'is_deleted'`);
    
    if (columns.length === 0) {
      // is_deleted kolonu ekle
      await queryRunner.query(`
        ALTER TABLE users 
        ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0
      `);
      console.log('is_deleted kolonu eklendi');

      // deleted_at kolonu ekle
      await queryRunner.query(`
        ALTER TABLE users 
        ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL
      `);
      console.log('deleted_at kolonu eklendi');

      console.log('Migration basariyla tamamlandi!');
    } else {
      console.log('Kolonlar zaten mevcut, migration atlanıyor.');
    }

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Migration hatasi:', error);
    process.exit(1);
  }
}

runMigration();


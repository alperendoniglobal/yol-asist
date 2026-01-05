import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add plain_password column to users table
 * Kullanıcı şifrelerinin plain text versiyonunu saklamak için
 * SADECE SUPER_ADMIN için gösterilir - güvenlik kritik
 */
export class AddPlainPasswordToUsers1702200000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // plain_password kolonu ekle (nullable, select: false - varsayılan olarak seçilmez)
    await queryRunner.query(`
      ALTER TABLE \`users\`
      ADD COLUMN \`plain_password\` VARCHAR(255) NULL DEFAULT NULL
    `);
    
    console.log('✅ users tablosuna plain_password kolonu eklendi');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Geri alma: plain_password kolonunu kaldır
    await queryRunner.query(`
      ALTER TABLE \`users\`
      DROP COLUMN \`plain_password\`
    `);
    
    console.log('⬇️ users tablosundan plain_password kolonu kaldırıldı');
  }
}


import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Payment Type Enum Güncelleme Migration
 * IYZICO değerini PAYTR ile değiştirir
 */
export class UpdatePaymentTypeEnum1702200000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // MySQL'de enum değerlerini güncellemek için ALTER TABLE kullanılır
    // Önce mevcut IYZICO değerlerini PAYTR'ye güncelle
    await queryRunner.query(`
      UPDATE payments 
      SET type = 'PAYTR' 
      WHERE type = 'IYZICO'
    `);

    // Enum'u güncelle (IYZICO'yu kaldır, PAYTR ekle)
    await queryRunner.query(`
      ALTER TABLE payments 
      MODIFY COLUMN type ENUM('PAYTR', 'BALANCE') NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Geri alma: PAYTR'yi IYZICO'ya geri çevir
    await queryRunner.query(`
      UPDATE payments 
      SET type = 'IYZICO' 
      WHERE type = 'PAYTR'
    `);

    // Enum'u eski haline getir
    await queryRunner.query(`
      ALTER TABLE payments 
      MODIFY COLUMN type ENUM('IYZICO', 'BALANCE') NOT NULL
    `);
  }
}


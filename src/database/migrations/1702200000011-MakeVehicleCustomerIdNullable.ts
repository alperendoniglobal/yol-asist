import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Make vehicles.customer_id nullable
 * Foreign key'i önce kaldırıp, kolonu değiştirip, sonra tekrar ekliyoruz
 */
export class MakeVehicleCustomerIdNullable1702200000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Foreign key constraint'i kaldır
    await queryRunner.query(`
      ALTER TABLE vehicles 
      DROP FOREIGN KEY FK_c1cda98f67cb9c79a1f1153e627
    `);

    // 2. Kolonu nullable yap
    await queryRunner.query(`
      ALTER TABLE vehicles 
      MODIFY COLUMN customer_id VARCHAR(36) NULL
    `);

    // 3. Foreign key'i tekrar ekle (ON DELETE SET NULL ile)
    await queryRunner.query(`
      ALTER TABLE vehicles 
      ADD CONSTRAINT FK_c1cda98f67cb9c79a1f1153e627 
      FOREIGN KEY (customer_id) REFERENCES customers(id) 
      ON DELETE SET NULL
    `);

    console.log('✅ vehicles.customer_id kolonu nullable yapıldı.');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Foreign key'i kaldır
    await queryRunner.query(`
      ALTER TABLE vehicles 
      DROP FOREIGN KEY FK_c1cda98f67cb9c79a1f1153e627
    `);

    // Kolonu NOT NULL yap
    await queryRunner.query(`
      ALTER TABLE vehicles 
      MODIFY COLUMN customer_id VARCHAR(36) NOT NULL
    `);

    // Foreign key'i tekrar ekle
    await queryRunner.query(`
      ALTER TABLE vehicles 
      ADD CONSTRAINT FK_c1cda98f67cb9c79a1f1153e627 
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    `);

    console.log('⬇️ vehicles.customer_id kolonu NOT NULL yapıldı.');
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Make payments.agency_id nullable
 * UserCustomer satışlarında agency_id null olabilir (acente olmadan direkt satış)
 */
export class MakePaymentAgencyIdNullable1702200000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Foreign key constraint ismini dinamik olarak bul
    const fkResult = await queryRunner.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'payments' 
        AND COLUMN_NAME = 'agency_id' 
        AND REFERENCED_TABLE_NAME = 'agencies'
      LIMIT 1
    `);

    const fkName = fkResult[0]?.CONSTRAINT_NAME;

    if (fkName) {
      // 1. Foreign key constraint'i kaldır
      await queryRunner.query(`
        ALTER TABLE payments 
        DROP FOREIGN KEY ${fkName}
      `);
      console.log(`✅ Foreign key ${fkName} kaldırıldı.`);
    }

    // 2. Kolonu nullable yap
    await queryRunner.query(`
      ALTER TABLE payments 
      MODIFY COLUMN agency_id VARCHAR(36) NULL
    `);
    console.log('✅ payments.agency_id kolonu nullable yapıldı.');

    // 3. Foreign key'i tekrar ekle (ON DELETE SET NULL ile)
    if (fkName) {
      await queryRunner.query(`
        ALTER TABLE payments 
        ADD CONSTRAINT ${fkName} 
        FOREIGN KEY (agency_id) REFERENCES agencies(id) 
        ON DELETE SET NULL
      `);
      console.log(`✅ Foreign key ${fkName} tekrar eklendi (ON DELETE SET NULL).`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Foreign key constraint ismini dinamik olarak bul
    const fkResult = await queryRunner.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'payments' 
        AND COLUMN_NAME = 'agency_id' 
        AND REFERENCED_TABLE_NAME = 'agencies'
      LIMIT 1
    `);

    const fkName = fkResult[0]?.CONSTRAINT_NAME;

    if (fkName) {
      // Foreign key'i kaldır
      await queryRunner.query(`
        ALTER TABLE payments 
        DROP FOREIGN KEY ${fkName}
      `);
    }

    // NULL değerleri olan kayıtları kontrol et
    const nullCount = await queryRunner.query(`
      SELECT COUNT(*) as count 
      FROM payments 
      WHERE agency_id IS NULL
    `);

    if (nullCount[0]?.count > 0) {
      throw new Error(
        `Cannot make agency_id NOT NULL: ${nullCount[0].count} payments have agency_id as NULL`
      );
    }

    // Kolonu NOT NULL yap
    await queryRunner.query(`
      ALTER TABLE payments 
      MODIFY COLUMN agency_id VARCHAR(36) NOT NULL
    `);

    // Foreign key'i tekrar ekle
    if (fkName) {
      await queryRunner.query(`
        ALTER TABLE payments 
        ADD CONSTRAINT ${fkName} 
        FOREIGN KEY (agency_id) REFERENCES agencies(id)
      `);
    }

    console.log('⬇️ payments.agency_id kolonu NOT NULL yapıldı.');
  }
}


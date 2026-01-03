import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Make sales.customer_id nullable
 * UserCustomer için satış oluştururken customer_id null olabilir
 * customer_id veya user_customer_id'den biri dolu olmalı
 */
export class MakeSaleCustomerIdNullable1702200000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Foreign key constraint ismini dinamik olarak bul
    const fkResult = await queryRunner.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'sales' 
        AND COLUMN_NAME = 'customer_id' 
        AND REFERENCED_TABLE_NAME = 'customers'
      LIMIT 1
    `);

    const fkName = fkResult[0]?.CONSTRAINT_NAME;

    if (fkName) {
      // 1. Foreign key constraint'i kaldır
      await queryRunner.query(`
        ALTER TABLE sales 
        DROP FOREIGN KEY ${fkName}
      `);
      console.log(`✅ Foreign key ${fkName} kaldırıldı.`);
    }

    // 2. Kolonu nullable yap
    await queryRunner.query(`
      ALTER TABLE sales 
      MODIFY COLUMN customer_id VARCHAR(36) NULL
    `);
    console.log('✅ sales.customer_id kolonu nullable yapıldı.');

    // 3. Foreign key'i tekrar ekle (ON DELETE SET NULL ile)
    if (fkName) {
      await queryRunner.query(`
        ALTER TABLE sales 
        ADD CONSTRAINT ${fkName} 
        FOREIGN KEY (customer_id) REFERENCES customers(id) 
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
        AND TABLE_NAME = 'sales' 
        AND COLUMN_NAME = 'customer_id' 
        AND REFERENCED_TABLE_NAME = 'customers'
      LIMIT 1
    `);

    const fkName = fkResult[0]?.CONSTRAINT_NAME;

    if (fkName) {
      // Foreign key'i kaldır
      await queryRunner.query(`
        ALTER TABLE sales 
        DROP FOREIGN KEY ${fkName}
      `);
    }

    // NULL değerleri olan kayıtları kontrol et
    const nullCount = await queryRunner.query(`
      SELECT COUNT(*) as count 
      FROM sales 
      WHERE customer_id IS NULL AND user_customer_id IS NULL
    `);

    if (nullCount[0]?.count > 0) {
      throw new Error(
        `Cannot make customer_id NOT NULL: ${nullCount[0].count} sales have both customer_id and user_customer_id as NULL`
      );
    }

    // Kolonu NOT NULL yap
    await queryRunner.query(`
      ALTER TABLE sales 
      MODIFY COLUMN customer_id VARCHAR(36) NOT NULL
    `);

    // Foreign key'i tekrar ekle
    if (fkName) {
      await queryRunner.query(`
        ALTER TABLE sales 
        ADD CONSTRAINT ${fkName} 
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      `);
    }

    console.log('⬇️ sales.customer_id kolonu NOT NULL yapıldı.');
  }
}


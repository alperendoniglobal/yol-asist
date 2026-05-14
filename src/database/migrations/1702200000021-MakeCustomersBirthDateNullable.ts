import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: customers.birth_date kolonunu NULL kabul edecek şekilde ayarlar.
 * Kurumsal müşterilerde doğum tarihi boş olabildiği için NULL olmalı;
 * boş string ('') MySQL DATE için geçersiz olduğundan INSERT hatası önlenir.
 */
export class MakeCustomersBirthDateNullable1702200000021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // customers.birth_date kolonunu DATE NULL yap (kurumsal müşteride boş kalabilir)
    await queryRunner.query(`
      ALTER TABLE customers
      MODIFY COLUMN birth_date DATE NULL COMMENT 'Doğum Tarihi'
    `);
    console.log('✅ customers.birth_date kolonu DATE NULL olarak güncellendi.');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Geri alırken kolonu yine DATE NULL bırakıyoruz (önceki hal nullable olabilir)
    await queryRunner.query(`
      ALTER TABLE customers
      MODIFY COLUMN birth_date DATE NULL COMMENT 'Doğum Tarihi'
    `);
    console.log('⬇️ customers.birth_date kolonu DATE NULL olarak bırakıldı (down).');
  }
}

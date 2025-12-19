import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Agencies tablosuna logo kolonunu ekler
 * - logo: Acente logosu (Base64 formatında, text, nullable)
 */
export class AddAgencyLogo1702200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // logo kolonu - Acente logosu (Base64 formatında)
    // LONGTEXT kullanıyoruz çünkü Base64 formatındaki resimler çok büyük olabilir (4GB'a kadar)
    await queryRunner.addColumn('agencies', new TableColumn({
      name: 'logo',
      type: 'longtext',
      isNullable: true,
      comment: 'Acente logosu (Base64 formatında)',
    }));

    console.log('✅ Agencies tablosuna logo kolonu eklendi');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Kolonu kaldır
    await queryRunner.dropColumn('agencies', 'logo');

    console.log('⬇️ Agencies tablosundan logo kolonu kaldırıldı');
  }
}


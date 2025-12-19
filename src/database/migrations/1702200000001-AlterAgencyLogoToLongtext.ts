import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Agencies tablosundaki logo kolonunu TEXT'ten LONGTEXT'e değiştirir
 * Base64 formatındaki resimler çok büyük olabileceği için LONGTEXT kullanıyoruz
 */
export class AlterAgencyLogoToLongtext1702200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Önce kolonun var olup olmadığını kontrol et
    const table = await queryRunner.getTable('agencies');
    const logoColumn = table?.findColumnByName('logo');

    if (logoColumn) {
      // Kolonu LONGTEXT'e değiştir
      await queryRunner.changeColumn('agencies', 'logo', new TableColumn({
        name: 'logo',
        type: 'longtext',
        isNullable: true,
        comment: 'Acente logosu (Base64 formatında)',
      }));

      console.log('✅ Agencies tablosundaki logo kolonu LONGTEXT olarak güncellendi');
    } else {
      // Kolon yoksa oluştur
      await queryRunner.addColumn('agencies', new TableColumn({
        name: 'logo',
        type: 'longtext',
        isNullable: true,
        comment: 'Acente logosu (Base64 formatında)',
      }));

      console.log('✅ Agencies tablosuna logo kolonu (LONGTEXT) eklendi');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Geri alma: TEXT'e döndür (ama genelde gerekmez)
    const table = await queryRunner.getTable('agencies');
    const logoColumn = table?.findColumnByName('logo');

    if (logoColumn) {
      await queryRunner.changeColumn('agencies', 'logo', new TableColumn({
        name: 'logo',
        type: 'text',
        isNullable: true,
        comment: 'Acente logosu (Base64 formatında)',
      }));

      console.log('⬇️ Agencies tablosundaki logo kolonu TEXT olarak geri alındı');
    }
  }
}


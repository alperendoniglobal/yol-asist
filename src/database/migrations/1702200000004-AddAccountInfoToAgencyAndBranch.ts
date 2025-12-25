import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Add account_name and iban to agencies and branches
 * Acente ve şubelere hesap adı ve IBAN alanları ekleniyor
 */
export class AddAccountInfoToAgencyAndBranch1702200000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Acentelere hesap bilgileri ekle
    await queryRunner.addColumn('agencies', new TableColumn({
      name: 'account_name',
      type: 'varchar',
      length: '255',
      isNullable: true,
      comment: 'Banka hesap adı'
    }));

    await queryRunner.addColumn('agencies', new TableColumn({
      name: 'iban',
      type: 'varchar',
      length: '34',
      isNullable: true,
      comment: 'Uluslararası Banka Hesap Numarası (IBAN)'
    }));

    // Şubelere hesap bilgileri ekle
    await queryRunner.addColumn('branches', new TableColumn({
      name: 'account_name',
      type: 'varchar',
      length: '255',
      isNullable: true,
      comment: 'Banka hesap adı'
    }));

    await queryRunner.addColumn('branches', new TableColumn({
      name: 'iban',
      type: 'varchar',
      length: '34',
      isNullable: true,
      comment: 'Uluslararası Banka Hesap Numarası (IBAN)'
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Şubelerden hesap bilgilerini kaldır
    await queryRunner.dropColumn('branches', 'iban');
    await queryRunner.dropColumn('branches', 'account_name');

    // Acentelerden hesap bilgilerini kaldır
    await queryRunner.dropColumn('agencies', 'iban');
    await queryRunner.dropColumn('agencies', 'account_name');
  }
}


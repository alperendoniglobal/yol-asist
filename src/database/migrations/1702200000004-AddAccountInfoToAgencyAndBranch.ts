import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Add account_name and iban to agencies and branches
 * Acente ve şubelere hesap adı ve IBAN alanları ekleniyor
 */
export class AddAccountInfoToAgencyAndBranch1702200000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Mevcut kolonları kontrol et (duplicate önlemek için)
    const agenciesTable = await queryRunner.getTable('agencies');
    const branchesTable = await queryRunner.getTable('branches');
    const agenciesColumns = agenciesTable?.columns.map(col => col.name) || [];
    const branchesColumns = branchesTable?.columns.map(col => col.name) || [];

    // Acentelere hesap bilgileri ekle - sadece yoksa
    if (!agenciesColumns.includes('account_name')) {
      await queryRunner.addColumn('agencies', new TableColumn({
        name: 'account_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: 'Banka hesap adı'
      }));
      console.log('✅ agencies.account_name kolonu eklendi.');
    } else {
      console.log('⚠️ agencies.account_name kolonu zaten mevcut, atlandı.');
    }

    if (!agenciesColumns.includes('iban')) {
      await queryRunner.addColumn('agencies', new TableColumn({
        name: 'iban',
        type: 'varchar',
        length: '34',
        isNullable: true,
        comment: 'Uluslararası Banka Hesap Numarası (IBAN)'
      }));
      console.log('✅ agencies.iban kolonu eklendi.');
    } else {
      console.log('⚠️ agencies.iban kolonu zaten mevcut, atlandı.');
    }

    // Şubelere hesap bilgileri ekle - sadece yoksa
    if (!branchesColumns.includes('account_name')) {
      await queryRunner.addColumn('branches', new TableColumn({
        name: 'account_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: 'Banka hesap adı'
      }));
      console.log('✅ branches.account_name kolonu eklendi.');
    } else {
      console.log('⚠️ branches.account_name kolonu zaten mevcut, atlandı.');
    }

    if (!branchesColumns.includes('iban')) {
      await queryRunner.addColumn('branches', new TableColumn({
        name: 'iban',
        type: 'varchar',
        length: '34',
        isNullable: true,
        comment: 'Uluslararası Banka Hesap Numarası (IBAN)'
      }));
      console.log('✅ branches.iban kolonu eklendi.');
    } else {
      console.log('⚠️ branches.iban kolonu zaten mevcut, atlandı.');
    }
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


import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Dağılımlı komisyon sistemi için migration
 * Şube varsa: Şube kendi komisyonunu alır, kalan kısım (acente komisyonu - şube komisyonu) acenteye gider
 * Şube yoksa: Sadece acente komisyonu
 */
export class AddDistributedCommission1702200000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Mevcut kolonları kontrol et (duplicate önlemek için)
    const table = await queryRunner.getTable('sales');
    const existingColumns = table?.columns.map(col => col.name) || [];

    // branch_commission kolonu ekle (şube komisyonu - TL) - sadece yoksa
    if (!existingColumns.includes('branch_commission')) {
      await queryRunner.addColumn(
        'sales',
        new TableColumn({
          name: 'branch_commission',
          type: 'decimal',
          precision: 10,
          scale: 2,
          isNullable: true,
          comment: 'Şube komisyonu (TL) - Şube varsa şube kendi komisyonunu alır',
        })
      );
      console.log('branch_commission kolonu eklendi.');
    } else {
      console.log('branch_commission kolonu zaten mevcut, atlandı.');
    }

    // agency_commission kolonu ekle (acente komisyonu - TL) - sadece yoksa
    if (!existingColumns.includes('agency_commission')) {
      await queryRunner.addColumn(
        'sales',
        new TableColumn({
          name: 'agency_commission',
          type: 'decimal',
          precision: 10,
          scale: 2,
          isNullable: true,
          comment: 'Acente komisyonu (TL) - Şube varsa kalan kısım (acente komisyonu - şube komisyonu), yoksa tamamı',
        })
      );
      console.log('agency_commission kolonu eklendi.');
    } else {
      console.log('agency_commission kolonu zaten mevcut, atlandı.');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Kolonları geri al
    await queryRunner.dropColumn('sales', 'agency_commission');
    await queryRunner.dropColumn('sales', 'branch_commission');
  }
}


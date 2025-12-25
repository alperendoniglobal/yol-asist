import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Dağılımlı komisyon sistemi için migration
 * Şube varsa: Şube kendi komisyonunu alır, kalan kısım (acente komisyonu - şube komisyonu) acenteye gider
 * Şube yoksa: Sadece acente komisyonu
 */
export class AddDistributedCommission1702200000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // branch_commission kolonu ekle (şube komisyonu - TL)
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

    // agency_commission kolonu ekle (acente komisyonu - TL)
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Kolonları geri al
    await queryRunner.dropColumn('sales', 'agency_commission');
    await queryRunner.dropColumn('sales', 'branch_commission');
  }
}


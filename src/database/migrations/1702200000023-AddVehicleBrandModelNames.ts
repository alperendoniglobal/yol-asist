import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Katalog dışı marka/model için serbest metin alanları.
 * brand_id/model_id null kalabilir; brand_name/model_name doldurulur.
 */
export class AddVehicleBrandModelNames1702200000023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('vehicles');
    if (!table) return;

    if (!table.columns.find((c) => c.name === 'brand_name')) {
      await queryRunner.addColumn(
        'vehicles',
        new TableColumn({
          name: 'brand_name',
          type: 'varchar',
          length: '255',
          isNullable: true,
          comment: 'Katalog dışı veya senkron marka adı',
        })
      );
    }

    if (!table.columns.find((c) => c.name === 'model_name')) {
      await queryRunner.addColumn(
        'vehicles',
        new TableColumn({
          name: 'model_name',
          type: 'varchar',
          length: '255',
          isNullable: true,
          comment: 'Katalog dışı veya senkron model adı',
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('vehicles');
    if (!table) return;

    if (table.columns.find((c) => c.name === 'model_name')) {
      await queryRunner.dropColumn('vehicles', 'model_name');
    }
    if (table.columns.find((c) => c.name === 'brand_name')) {
      await queryRunner.dropColumn('vehicles', 'brand_name');
    }
  }
}

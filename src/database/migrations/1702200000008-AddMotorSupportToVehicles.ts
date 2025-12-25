import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Vehicle tablosuna motosiklet desteği ekler
 * vehicle_type, motor_brand_id ve motor_model_id kolonları eklenir
 */
export class AddMotorSupportToVehicles1702200000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Mevcut kolonları kontrol et
    const table = await queryRunner.getTable('vehicles');
    const existingColumns = table?.columns.map(col => col.name) || [];

    // vehicle_type kolonu ekle (araç tipi: Otomobil, Motosiklet, vs.)
    if (!existingColumns.includes('vehicle_type')) {
      await queryRunner.addColumn(
        'vehicles',
        new TableColumn({
          name: 'vehicle_type',
          type: 'varchar',
          length: '50',
          isNullable: true,
          comment: 'Araç tipi: Otomobil, Motosiklet, Minibüs, vs.',
        })
      );
      console.log('vehicle_type kolonu eklendi.');
    } else {
      console.log('vehicle_type kolonu zaten mevcut, atlandı.');
    }

    // motor_brand_id kolonu ekle (motosiklet markası için)
    if (!existingColumns.includes('motor_brand_id')) {
      await queryRunner.addColumn(
        'vehicles',
        new TableColumn({
          name: 'motor_brand_id',
          type: 'int',
          isNullable: true,
          comment: 'Motosiklet marka ID (motor_brands tablosundan)',
        })
      );
      console.log('motor_brand_id kolonu eklendi.');
    } else {
      console.log('motor_brand_id kolonu zaten mevcut, atlandı.');
    }

    // motor_model_id kolonu ekle (motosiklet modeli için)
    if (!existingColumns.includes('motor_model_id')) {
      await queryRunner.addColumn(
        'vehicles',
        new TableColumn({
          name: 'motor_model_id',
          type: 'int',
          isNullable: true,
          comment: 'Motosiklet model ID (motor_models tablosundan)',
        })
      );
      console.log('motor_model_id kolonu eklendi.');
    } else {
      console.log('motor_model_id kolonu zaten mevcut, atlandı.');
    }

    // Foreign key'leri ekle (duplicate kontrolü ile)
    const existingForeignKeys = table?.foreignKeys || [];

    // motor_brand_id foreign key
    const motorBrandFkExists = existingForeignKeys.some(
      fk => fk.columnNames.includes('motor_brand_id') && fk.referencedTableName === 'motor_brands'
    );
    if (!motorBrandFkExists) {
      await queryRunner.createForeignKey(
        'vehicles',
        new TableForeignKey({
          name: 'FK_vehicles_motor_brand_id',
          columnNames: ['motor_brand_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'motor_brands',
          onDelete: 'RESTRICT',
        })
      );
      console.log('motor_brand_id foreign key eklendi.');
    } else {
      console.log('motor_brand_id foreign key zaten mevcut, atlandı.');
    }

    // motor_model_id foreign key
    const motorModelFkExists = existingForeignKeys.some(
      fk => fk.columnNames.includes('motor_model_id') && fk.referencedTableName === 'motor_models'
    );
    if (!motorModelFkExists) {
      await queryRunner.createForeignKey(
        'vehicles',
        new TableForeignKey({
          name: 'FK_vehicles_motor_model_id',
          columnNames: ['motor_model_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'motor_models',
          onDelete: 'RESTRICT',
        })
      );
      console.log('motor_model_id foreign key eklendi.');
    } else {
      console.log('motor_model_id foreign key zaten mevcut, atlandı.');
    }

    // Index'leri ekle (performans için)
    const existingIndexes = table?.indices || [];

    // motor_brand_id index
    const motorBrandIndexExists = existingIndexes.some(
      idx => idx.name === 'IDX_vehicles_motor_brand_id'
    );
    if (!motorBrandIndexExists) {
      await queryRunner.createIndex(
        'vehicles',
        new TableIndex({
          name: 'IDX_vehicles_motor_brand_id',
          columnNames: ['motor_brand_id'],
        })
      );
      console.log('IDX_vehicles_motor_brand_id index eklendi.');
    } else {
      console.log('IDX_vehicles_motor_brand_id index zaten mevcut, atlandı.');
    }

    // motor_model_id index
    const motorModelIndexExists = existingIndexes.some(
      idx => idx.name === 'IDX_vehicles_motor_model_id'
    );
    if (!motorModelIndexExists) {
      await queryRunner.createIndex(
        'vehicles',
        new TableIndex({
          name: 'IDX_vehicles_motor_model_id',
          columnNames: ['motor_model_id'],
        })
      );
      console.log('IDX_vehicles_motor_model_id index eklendi.');
    } else {
      console.log('IDX_vehicles_motor_model_id index zaten mevcut, atlandı.');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Foreign key'leri kaldır
    const table = await queryRunner.getTable('vehicles');
    if (table) {
      const motorBrandFk = table.foreignKeys.find(fk => fk.columnNames.indexOf('motor_brand_id') !== -1);
      if (motorBrandFk) {
        await queryRunner.dropForeignKey('vehicles', motorBrandFk);
      }

      const motorModelFk = table.foreignKeys.find(fk => fk.columnNames.indexOf('motor_model_id') !== -1);
      if (motorModelFk) {
        await queryRunner.dropForeignKey('vehicles', motorModelFk);
      }
    }

    // Index'leri kaldır
    await queryRunner.dropIndex('vehicles', 'IDX_vehicles_motor_model_id');
    await queryRunner.dropIndex('vehicles', 'IDX_vehicles_motor_brand_id');

    // Kolonları kaldır
    await queryRunner.dropColumn('vehicles', 'motor_model_id');
    await queryRunner.dropColumn('vehicles', 'motor_brand_id');
    await queryRunner.dropColumn('vehicles', 'vehicle_type');
  }
}


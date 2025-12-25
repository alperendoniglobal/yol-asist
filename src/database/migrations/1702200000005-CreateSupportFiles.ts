import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSupportFiles1702200000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'support_files',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: '(UUID())',
          },
          {
            name: 'sale_id',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '36',
            isNullable: true, // nullable: true çünkü onDelete: 'SET NULL' kullanılıyor
          },
          {
            name: 'damage_file_number',
            type: 'varchar',
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'policy_number',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'damage_policy_number',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'policy_start_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'insured_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'insured_phone',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'vehicle_plate',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'vehicle_model',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'model_year',
            type: 'varchar',
            length: '10',
            isNullable: true,
          },
          {
            name: 'vehicle_brand',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'vehicle_segment',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'service_type',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'service_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'roadside_assistance_coverage',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'city',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'staff_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'kilometer',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'heavy_commercial',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'start_address',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'end_address',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'request_date_time',
            type: 'datetime',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Foreign keys - Manuel isimler vererek duplicate constraint hatasını önliyoruz
    // Constraint'in zaten var olup olmadığını kontrol et
    const table = await queryRunner.getTable('support_files');
    const existingForeignKeys = table?.foreignKeys || [];

    // sale_id foreign key'i kontrol et ve ekle
    const saleFkExists = existingForeignKeys.some(
      fk => fk.columnNames.includes('sale_id') && fk.referencedTableName === 'sales'
    );
    if (!saleFkExists) {
      await queryRunner.createForeignKey(
        'support_files',
        new TableForeignKey({
          name: 'FK_support_files_sale_id', // Manuel isim veriyoruz
          columnNames: ['sale_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'sales',
          onDelete: 'CASCADE',
        })
      );
    }

    // created_by foreign key'i kontrol et ve ekle
    const createdByFkExists = existingForeignKeys.some(
      fk => fk.columnNames.includes('created_by') && fk.referencedTableName === 'users'
    );
    if (!createdByFkExists) {
      await queryRunner.createForeignKey(
        'support_files',
        new TableForeignKey({
          name: 'FK_support_files_created_by', // Manuel isim veriyoruz
          columnNames: ['created_by'],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'SET NULL',
        })
      );
    }

    // Index for damage_file_number (unique)
    await queryRunner.createIndex(
      'support_files',
      new TableIndex({
        name: 'IDX_support_files_damage_file_number',
        columnNames: ['damage_file_number'],
        isUnique: true,
      })
    );

    // Index for sale_id (for faster queries)
    await queryRunner.createIndex(
      'support_files',
      new TableIndex({
        name: 'IDX_support_files_sale_id',
        columnNames: ['sale_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('support_files');
  }
}



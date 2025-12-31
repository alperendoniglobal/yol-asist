import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableColumn } from 'typeorm';

/**
 * UserCustomers tablosu ve ilişkili foreign key'leri oluşturur
 * Bireysel kullanıcılar için - kendileri kayıt olup, giriş yapıp paket satın alabilirler
 */
export class CreateUserCustomers1702200000010 implements MigrationInterface {
  name = 'CreateUserCustomers1702200000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tablo zaten var mı kontrol et
    const tableExists = await queryRunner.hasTable('user_customers');
    if (tableExists) {
      console.log('user_customers tablosu zaten mevcut, atlanıyor...');
      return;
    }

    // 1. user_customers tablosunu oluştur
    await queryRunner.createTable(
      new Table({
        name: 'user_customers',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'tc_vkn',
            type: 'varchar',
            length: '11',
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'surname',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'password',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'city',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'district',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'address',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
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

    // 2. vehicles tablosuna user_customer_id kolonu ekle (yoksa)
    const vehiclesTable = await queryRunner.getTable('vehicles');
    if (vehiclesTable && !vehiclesTable.columns.find(c => c.name === 'user_customer_id')) {
      await queryRunner.addColumn(
        'vehicles',
        new TableColumn({
          name: 'user_customer_id',
          type: 'varchar',
          length: '36',
          isNullable: true,
        })
      );
    }

    // 3. sales tablosuna user_customer_id kolonu ekle (yoksa)
    const salesTable = await queryRunner.getTable('sales');
    if (salesTable && !salesTable.columns.find(c => c.name === 'user_customer_id')) {
      await queryRunner.addColumn(
        'sales',
        new TableColumn({
          name: 'user_customer_id',
          type: 'varchar',
          length: '36',
          isNullable: true,
        })
      );
    }

    // 4. vehicles tablosuna user_customer_id foreign key ekle
    if (vehiclesTable && vehiclesTable.columns.find(c => c.name === 'user_customer_id')) {
      await queryRunner.createForeignKey(
        'vehicles',
        new TableForeignKey({
          name: 'FK_vehicles_user_customer',
          columnNames: ['user_customer_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'user_customers',
          onDelete: 'CASCADE',
        })
      );
    }

    // 5. sales tablosuna user_customer_id foreign key ekle
    if (salesTable && salesTable.columns.find(c => c.name === 'user_customer_id')) {
      await queryRunner.createForeignKey(
        'sales',
        new TableForeignKey({
          name: 'FK_sales_user_customer',
          columnNames: ['user_customer_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'user_customers',
          onDelete: 'CASCADE',
        })
      );
    }

    console.log('✓ user_customers tablosu başarıyla oluşturuldu');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Foreign key'leri kaldır
    const vehiclesTable = await queryRunner.getTable('vehicles');
    const salesTable = await queryRunner.getTable('sales');

    if (vehiclesTable) {
      const vehiclesFk = vehiclesTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('user_customer_id') !== -1
      );
      if (vehiclesFk) {
        await queryRunner.dropForeignKey('vehicles', vehiclesFk);
      }
      if (vehiclesTable.columns.find(c => c.name === 'user_customer_id')) {
        await queryRunner.dropColumn('vehicles', 'user_customer_id');
      }
    }

    if (salesTable) {
      const salesFk = salesTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('user_customer_id') !== -1
      );
      if (salesFk) {
        await queryRunner.dropForeignKey('sales', salesFk);
      }
      if (salesTable.columns.find(c => c.name === 'user_customer_id')) {
        await queryRunner.dropColumn('sales', 'user_customer_id');
      }
    }

    // user_customers tablosunu sil
    await queryRunner.dropTable('user_customers', true);
    console.log('✓ user_customers tablosu başarıyla silindi');
  }
}


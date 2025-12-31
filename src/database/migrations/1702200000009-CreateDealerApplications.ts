import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Bayilik Başvuruları Tablosu
 * Acente olmak isteyen kişilerin başvurularını saklar.
 */
export class CreateDealerApplications1702200000009 implements MigrationInterface {
  name = 'CreateDealerApplications1702200000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // dealer_applications tablosu zaten var mı kontrol et
    const tableExists = await queryRunner.hasTable('dealer_applications');
    if (tableExists) {
      console.log('dealer_applications tablosu zaten mevcut, atlanıyor...');
      return;
    }

    // dealer_applications tablosunu oluştur
    await queryRunner.createTable(
      new Table({
        name: 'dealer_applications',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'surname',
            type: 'varchar',
            length: '100',
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
            length: '20',
          },
          {
            name: 'tc_vkn',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'company_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'city',
            type: 'varchar',
            length: '100',
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
            name: 'referral_code',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'password_hash',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'APPROVED', 'REJECTED'],
            default: "'PENDING'",
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reviewed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'reviewed_by',
            type: 'varchar',
            length: '36',
            isNullable: true,
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
      true,
    );

    // Status için index oluştur (filtreleme için)
    await queryRunner.createIndex(
      'dealer_applications',
      new TableIndex({
        name: 'IDX_dealer_applications_status',
        columnNames: ['status'],
      }),
    );

    // Email için index (unique zaten var ama arama için)
    await queryRunner.createIndex(
      'dealer_applications',
      new TableIndex({
        name: 'IDX_dealer_applications_email',
        columnNames: ['email'],
      }),
    );

    // reviewed_by foreign key
    await queryRunner.createForeignKey(
      'dealer_applications',
      new TableForeignKey({
        name: 'FK_dealer_applications_reviewed_by',
        columnNames: ['reviewed_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    console.log('✓ dealer_applications tablosu başarıyla oluşturuldu');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Foreign key'i kaldır
    const table = await queryRunner.getTable('dealer_applications');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.includes('reviewed_by'),
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('dealer_applications', foreignKey);
      }
    }

    // Tabloyu sil
    await queryRunner.dropTable('dealer_applications', true);
    console.log('✓ dealer_applications tablosu başarıyla silindi');
  }
}


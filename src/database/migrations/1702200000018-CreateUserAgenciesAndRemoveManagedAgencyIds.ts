import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Create user_agencies junction table and remove managed_agency_ids column
 * SUPER_AGENCY_ADMIN rolündeki kullanıcıların birden fazla broker yönetebilmesi için
 * junction table kullanılacak (managed_agency_ids JSON kolonu yerine)
 */
export class CreateUserAgenciesAndRemoveManagedAgencyIds1702200000018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. user_agencies junction table'ı oluştur
    const userAgenciesTable = await queryRunner.getTable('user_agencies');
    
    if (!userAgenciesTable) {
      await queryRunner.createTable(
        new Table({
          name: 'user_agencies',
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
              name: 'user_id',
              type: 'varchar',
              length: '36',
              isNullable: false,
            },
            {
              name: 'agency_id',
              type: 'varchar',
              length: '36',
              isNullable: false,
            },
            {
              name: 'created_at',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true
      );

      // Foreign key: user_id -> users.id
      await queryRunner.createForeignKey(
        'user_agencies',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'CASCADE',
          name: 'FK_user_agencies_user_id',
        })
      );

      // Foreign key: agency_id -> agencies.id
      await queryRunner.createForeignKey(
        'user_agencies',
        new TableForeignKey({
          columnNames: ['agency_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'agencies',
          onDelete: 'CASCADE',
          name: 'FK_user_agencies_agency_id',
        })
      );

      console.log('✅ user_agencies junction table oluşturuldu');
    } else {
      console.log('⚠️ user_agencies tablosu zaten mevcut, atlandı');
      
      // Tablo mevcut ama unique index yoksa, önce boş/geçersiz kayıtları temizle
      // Boş string veya NULL değerleri olan kayıtları sil
      await queryRunner.query(`
        DELETE FROM user_agencies 
        WHERE user_id = '' OR user_id IS NULL 
           OR agency_id = '' OR agency_id IS NULL
      `);
      console.log('✅ Boş/geçersiz user_agencies kayıtları temizlendi');
      
      // Duplicate kayıtları temizle (her user_id + agency_id kombinasyonundan sadece birini tut)
      await queryRunner.query(`
        DELETE ua1 FROM user_agencies ua1
        INNER JOIN user_agencies ua2 
        WHERE ua1.id > ua2.id 
          AND ua1.user_id = ua2.user_id 
          AND ua1.agency_id = ua2.agency_id
      `);
      console.log('✅ Duplicate user_agencies kayıtları temizlendi');
    }
    
    // Unique index'i kontrol et ve yoksa oluştur
    const existingIndex = await queryRunner.query(`
      SELECT COUNT(*) as count
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'user_agencies'
        AND index_name = 'IDX_user_agencies_user_agency'
    `);
    
    if (existingIndex[0].count === 0) {
      await queryRunner.createIndex(
        'user_agencies',
        new TableIndex({
          name: 'IDX_user_agencies_user_agency',
          columnNames: ['user_id', 'agency_id'],
          isUnique: true,
        })
      );
      console.log('✅ Unique index oluşturuldu');
    } else {
      console.log('⚠️ Unique index zaten mevcut, atlandı');
    }

    // 2. Mevcut managed_agency_ids verilerini user_agencies tablosuna taşı
    const usersTable = await queryRunner.getTable('users');
    if (usersTable && usersTable.columns.find(col => col.name === 'managed_agency_ids')) {
      // managed_agency_ids kolonunda veri olan kullanıcıları bul ve user_agencies'e taşı
      const usersWithManagedAgencies = await queryRunner.query(`
        SELECT id, managed_agency_ids 
        FROM users 
        WHERE managed_agency_ids IS NOT NULL 
        AND JSON_LENGTH(managed_agency_ids) > 0
      `);

      for (const user of usersWithManagedAgencies) {
        try {
          const agencyIds = JSON.parse(user.managed_agency_ids);
          if (Array.isArray(agencyIds) && agencyIds.length > 0) {
            for (const agencyId of agencyIds) {
              // Her agency_id için user_agencies kaydı oluştur
              await queryRunner.query(`
                INSERT IGNORE INTO user_agencies (id, user_id, agency_id, created_at)
                VALUES (UUID(), ?, ?, NOW())
              `, [user.id, agencyId]);
            }
            console.log(`✅ User ${user.id} için ${agencyIds.length} broker user_agencies tablosuna taşındı`);
          }
        } catch (error) {
          console.error(`⚠️ User ${user.id} için managed_agency_ids parse hatası:`, error);
        }
      }
    }

    // 3. managed_agency_ids kolonunu kaldır
    const table = await queryRunner.getTable('users');
    if (table && table.columns.find(column => column.name === 'managed_agency_ids')) {
      await queryRunner.dropColumn('users', 'managed_agency_ids');
      console.log('✅ users tablosundan managed_agency_ids kolonu kaldırıldı');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. managed_agency_ids kolonunu geri ekle
    const table = await queryRunner.getTable('users');
    if (table && !table.columns.find(column => column.name === 'managed_agency_ids')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'managed_agency_ids',
          type: 'json',
          isNullable: true,
          comment: 'AGENCY_ADMIN için yönettiği acente ID\'leri (JSON array)',
        })
      );
      console.log('✅ users tablosuna managed_agency_ids kolonu geri eklendi');
    }

    // 2. user_agencies verilerini managed_agency_ids'e geri taşı
    const userAgencies = await queryRunner.query(`
      SELECT user_id, GROUP_CONCAT(agency_id) as agency_ids
      FROM user_agencies
      GROUP BY user_id
    `);

    for (const row of userAgencies) {
      const agencyIds = row.agency_ids.split(',').map((id: string) => id.trim());
      await queryRunner.query(`
        UPDATE users 
        SET managed_agency_ids = ?
        WHERE id = ?
      `, [JSON.stringify(agencyIds), row.user_id]);
    }

    // 3. user_agencies tablosunu kaldır
    const userAgenciesTable = await queryRunner.getTable('user_agencies');
    if (userAgenciesTable) {
      await queryRunner.dropTable('user_agencies');
      console.log('⬇️ user_agencies tablosu kaldırıldı');
    }
  }
}


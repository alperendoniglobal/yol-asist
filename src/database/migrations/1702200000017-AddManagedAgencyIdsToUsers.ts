import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Add managed_agency_ids column to users table
 * AGENCY_ADMIN rolündeki kullanıcıların birden fazla acenteyi yönetebilmesi için
 * JSON array formatında acente ID'lerini saklar
 */
export class AddManagedAgencyIdsToUsers1702200000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    
    // Kolon zaten varsa atla
    if (table && !table.columns.find(column => column.name === 'managed_agency_ids')) {
      await queryRunner.addColumn('users', new TableColumn({
        name: 'managed_agency_ids',
        type: 'json',
        isNullable: true,
        comment: 'AGENCY_ADMIN için yönettiği acente ID\'leri (JSON array)'
      }));
      
      console.log('✅ users tablosuna managed_agency_ids kolonu eklendi');
    } else {
      console.log('⚠️ users.managed_agency_ids kolonu zaten mevcut, atlandı');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    
    // Geri alma: managed_agency_ids kolonunu kaldır
    if (table && table.columns.find(column => column.name === 'managed_agency_ids')) {
      await queryRunner.dropColumn('users', 'managed_agency_ids');
      console.log('⬇️ users tablosundan managed_agency_ids kolonu kaldırıldı');
    }
  }
}


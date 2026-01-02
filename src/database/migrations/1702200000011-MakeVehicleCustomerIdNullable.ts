import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Make vehicles.customer_id nullable
 * UserCustomer için araç oluştururken customer_id null olabilir
 * customer_id veya user_customer_id'den biri dolu olmalı
 */
export class MakeVehicleCustomerIdNullable1702200000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // vehicles tablosunu kontrol et
    const vehiclesTable = await queryRunner.getTable('vehicles');
    
    if (vehiclesTable) {
      const customerIdColumn = vehiclesTable.columns.find(c => c.name === 'customer_id');
      
      // Eğer customer_id kolonu var ve nullable değilse, nullable yap
      if (customerIdColumn && !customerIdColumn.isNullable) {
        await queryRunner.changeColumn(
          'vehicles',
          'customer_id',
          new TableColumn({
            name: 'customer_id',
            type: 'varchar',
            length: '36',
            isNullable: true,
            comment: 'Acente müşterisi için (Customer tablosundan). UserCustomer için null olabilir.',
          })
        );
        console.log('✅ vehicles.customer_id kolonu nullable yapıldı.');
      } else {
        console.log('⚠️ vehicles.customer_id kolonu zaten nullable veya bulunamadı.');
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Geri alma - customer_id'yi tekrar NOT NULL yap (dikkatli ol!)
    // Bu migration'ı geri almak veri kaybına neden olabilir
    const vehiclesTable = await queryRunner.getTable('vehicles');
    
    if (vehiclesTable) {
      const customerIdColumn = vehiclesTable.columns.find(c => c.name === 'customer_id');
      
      if (customerIdColumn && customerIdColumn.isNullable) {
        // Önce NULL değerleri olan kayıtları kontrol et
        const nullCount = await queryRunner.query(
          `SELECT COUNT(*) as count FROM vehicles WHERE customer_id IS NULL AND user_customer_id IS NULL`
        );
        
        if (nullCount[0]?.count > 0) {
          throw new Error(
            `Cannot make customer_id NOT NULL: ${nullCount[0].count} vehicles have both customer_id and user_customer_id as NULL`
          );
        }
        
        await queryRunner.changeColumn(
          'vehicles',
          'customer_id',
          new TableColumn({
            name: 'customer_id',
            type: 'varchar',
            length: '36',
            isNullable: false,
          })
        );
        console.log('⬇️ vehicles.customer_id kolonu NOT NULL yapıldı.');
      }
    }
  }
}


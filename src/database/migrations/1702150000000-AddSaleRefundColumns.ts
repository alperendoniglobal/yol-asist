import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Sales tablosuna iade (refund) kolonlarını ekler
 * - is_refunded: İade yapıldı mı? (boolean, default: false)
 * - refunded_at: İade tarihi (timestamp, nullable)
 * - refund_amount: İade tutarı (decimal, nullable)
 * - refund_reason: İade sebebi (text, nullable)
 * - refunded_by: İade yapan kullanıcı ID (uuid, nullable)
 */
export class AddSaleRefundColumns1702150000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // is_refunded kolonu - İade yapıldı mı?
    await queryRunner.addColumn('sales', new TableColumn({
      name: 'is_refunded',
      type: 'boolean',
      default: false,
      isNullable: false,
    }));

    // refunded_at kolonu - İade tarihi
    await queryRunner.addColumn('sales', new TableColumn({
      name: 'refunded_at',
      type: 'timestamp',
      isNullable: true,
    }));

    // refund_amount kolonu - İade tutarı (TL)
    await queryRunner.addColumn('sales', new TableColumn({
      name: 'refund_amount',
      type: 'decimal',
      precision: 10,
      scale: 2,
      isNullable: true,
    }));

    // refund_reason kolonu - İade sebebi
    await queryRunner.addColumn('sales', new TableColumn({
      name: 'refund_reason',
      type: 'text',
      isNullable: true,
    }));

    // refunded_by kolonu - İade yapan kullanıcı
    await queryRunner.addColumn('sales', new TableColumn({
      name: 'refunded_by',
      type: 'varchar',
      length: '36',
      isNullable: true,
    }));

    console.log('✅ Sales tablosuna iade kolonları eklendi');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Kolonları kaldır
    await queryRunner.dropColumn('sales', 'refunded_by');
    await queryRunner.dropColumn('sales', 'refund_reason');
    await queryRunner.dropColumn('sales', 'refund_amount');
    await queryRunner.dropColumn('sales', 'refunded_at');
    await queryRunner.dropColumn('sales', 'is_refunded');

    console.log('⬇️ Sales tablosundan iade kolonları kaldırıldı');
  }
}


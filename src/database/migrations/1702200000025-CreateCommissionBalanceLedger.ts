import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Broker/acente bakiye hareket geçmişi (audit log) tablosu.
 *
 * Not: Bu migration daha önce canlı sunucuda elle oluşturulup çalıştırılmış
 * (kaynak kodu commit edilmeden) — bu dosya, o çalışmış migration'ın kaynak
 * kodunu geriye dönük tamamlar. up() zaten "tablo varsa atla" mantığında
 * olduğu için tekrar çalıştırılması güvenlidir (idempotent).
 */
export class CreateCommissionBalanceLedger1702200000025 implements MigrationInterface {
  name = 'CreateCommissionBalanceLedger1702200000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('commission_balance_ledger');
    if (exists) return;

    await queryRunner.createTable(
      new Table({
        name: 'commission_balance_ledger',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'entity_type',
            type: 'enum',
            enum: ['agency', 'branch'],
          },
          {
            name: 'entity_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'delta',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'balance_after',
            type: 'decimal',
            precision: 12,
            scale: 2,
          },
          {
            name: 'reason',
            type: 'enum',
            enum: [
              'SALE_CREDIT',
              'COMMISSION_PAID',
              'BALANCE_SALE',
              'REFUND',
              'TRANSFER',
              'ADJUSTMENT',
            ],
          },
          {
            name: 'ref_type',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'ref_id',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'commission_balance_ledger',
      new TableIndex({
        name: 'IDX_commission_ledger_entity',
        columnNames: ['entity_type', 'entity_id'],
      })
    );
    await queryRunner.createIndex(
      'commission_balance_ledger',
      new TableIndex({
        name: 'IDX_commission_ledger_created',
        columnNames: ['created_at'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('commission_balance_ledger');
    if (!exists) return;
    await queryRunner.dropTable('commission_balance_ledger');
  }
}

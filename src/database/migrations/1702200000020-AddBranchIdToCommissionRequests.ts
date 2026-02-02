import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

/**
 * Komisyon talebine şube ödemesi desteği: branch_id eklenir.
 * branch_id doluysa ödeme şubeye (branch.balance'dan düşülür), nullsa acenteye (agency.balance'dan düşülür).
 */
export class AddBranchIdToCommissionRequests1702200000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('commission_requests');
    const hasBranchId = table?.columns.find(c => c.name === 'branch_id');
    if (!hasBranchId) {
      await queryRunner.addColumn(
        'commission_requests',
        new TableColumn({
          name: 'branch_id',
          type: 'varchar',
          length: '36',
          isNullable: true,
          comment: 'Şube ödemesi ise şube ID; null ise acente ödemesi',
        })
      );
      await queryRunner.createForeignKey(
        'commission_requests',
        new TableForeignKey({
          columnNames: ['branch_id'],
          referencedTableName: 'branches',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('commission_requests');
    const fk = table?.foreignKeys.find(f => f.columnNames.indexOf('branch_id') !== -1);
    if (fk) await queryRunner.dropForeignKey('commission_requests', fk);
    await queryRunner.dropColumn('commission_requests', 'branch_id');
  }
}

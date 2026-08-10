import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Eski model: DB ≈ satış günü, PDF = DB+7.
 * PDF kaydırması kalktığı için mevcut kayıtların start/end +7 ile
 * müşteriye giden eski PDF metniyle hizalanır.
 */
export class ShiftSaleDatesPlus7ForPdfAlign1702200000024 implements MigrationInterface {
  name = 'ShiftSaleDatesPlus7ForPdfAlign1702200000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE sales
      SET
        start_date = DATE_ADD(start_date, INTERVAL 7 DAY),
        end_date = DATE_ADD(end_date, INTERVAL 7 DAY)
      WHERE start_date IS NOT NULL
        AND end_date IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE sales
      SET
        start_date = DATE_SUB(start_date, INTERVAL 7 DAY),
        end_date = DATE_SUB(end_date, INTERVAL 7 DAY)
      WHERE start_date IS NOT NULL
        AND end_date IS NOT NULL
    `);
  }
}

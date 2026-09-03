import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Komisyon KDV hatası düzeltmesi.
 *
 * Kök neden: SaleService'teki komisyon hesabı, satış fiyatından KDV
 * (%20) düşülmeden hesaplanıyordu (price * rate / 100 yerine doğrusu
 * (price / 1.20) * rate / 100). Bu migration, o hatayla hesaplanmış
 * GEÇMİŞ satışların branch_commission/agency_commission/commission
 * değerlerini, satış anındaki kendi oranlarını KORUYARAK (branches/
 * agencies.commission_rate'in ŞİMDİKİ değerini kullanmadan) düzeltir
 * — sadece eksik olan KDV adımını ekler (eski değer / 1.20).
 *
 * Kod tarafındaki asıl düzeltme (yeni satışlar için) ayrı bir commit'te:
 * SaleService.calculateCommission / calculateDistributedCommission.
 *
 * Kapsam dışı: bakiyeden (BALANCE) ödenen satışlarda zaten komisyon
 * kesilmediği için onlara dokunulmaz.
 */
export class FixCommissionVatCalculation1702200000026 implements MigrationInterface {
  name = 'FixCommissionVatCalculation1702200000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0) Geri alma için yedek — bu tablolar down() tarafından kullanılır,
    //    migration:revert dışında elle silinmemeli.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS _backup_sales_commission_1702200000026 AS
      SELECT id, commission, branch_commission, agency_commission FROM sales
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS _backup_branches_balance_1702200000026 AS
      SELECT id, balance FROM branches
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS _backup_agencies_balance_1702200000026 AS
      SELECT id, balance FROM agencies
    `);

    // 1) branch_commission / agency_commission: eski (KDV dahil) formülle
    //    eşleşen satırları /1.20 ile düzelt. Diğerlerine (zaten doğru
    //    olanlara, veya farklı bir oranla hesaplanmış olanlara) dokunma.
    await queryRunner.query(`
      UPDATE sales s
      JOIN agencies a ON a.id = s.agency_id
      LEFT JOIN branches b ON b.id = s.branch_id
      SET
        s.branch_commission = CASE
          WHEN b.id IS NOT NULL
            AND ABS(COALESCE(s.branch_commission,0) - ROUND(s.price * b.commission_rate / 100, 2)) < 0.02
            THEN ROUND(s.branch_commission / 1.20, 2)
          ELSE s.branch_commission
        END,
        s.agency_commission = CASE
          WHEN ABS(COALESCE(s.agency_commission,0) -
             ROUND(CASE WHEN b.id IS NOT NULL THEN s.price * (a.commission_rate - b.commission_rate) / 100
                        ELSE s.price * a.commission_rate / 100 END, 2)) < 0.02
            THEN ROUND(s.agency_commission / 1.20, 2)
          ELSE s.agency_commission
        END
      WHERE NOT EXISTS (
        SELECT 1 FROM payments p
        WHERE p.sale_id = s.id AND p.type = 'BALANCE' AND p.status = 'COMPLETED'
      )
      AND (
        (b.id IS NOT NULL AND ABS(COALESCE(s.branch_commission,0) - ROUND(s.price * b.commission_rate / 100, 2)) < 0.02)
        OR
        ABS(COALESCE(s.agency_commission,0) -
           ROUND(CASE WHEN b.id IS NOT NULL THEN s.price * (a.commission_rate - b.commission_rate) / 100
                      ELSE s.price * a.commission_rate / 100 END, 2)) < 0.02
      )
    `);

    // 2) commission (toplam) kolonunu branch_commission + agency_commission
    //    ile tutarlı hale getir.
    await queryRunner.query(`
      UPDATE sales s
      SET s.commission = ROUND(COALESCE(s.branch_commission,0) + COALESCE(s.agency_commission,0), 2)
      WHERE NOT EXISTS (
        SELECT 1 FROM payments p
        WHERE p.sale_id = s.id AND p.type = 'BALANCE' AND p.status = 'COMPLETED'
      )
      AND ABS(COALESCE(s.branch_commission,0) + COALESCE(s.agency_commission,0) - COALESCE(s.commission,0)) > 0.02
    `);

    // 3) branches.balance'ı düzeltilmiş verilerden yeniden hesapla:
    //    bakiye = (bakiyeyle ödenmemiş satışlardaki toplam branch_commission) - (fiilen PAID olan komisyon talepleri)
    await queryRunner.query(`
      UPDATE branches b
      SET b.balance = ROUND(
          (SELECT COALESCE(SUM(s.branch_commission), 0) FROM sales s
           WHERE s.branch_id = b.id
             AND NOT EXISTS (
               SELECT 1 FROM payments p
               WHERE p.sale_id = s.id AND p.type = 'BALANCE' AND p.status = 'COMPLETED'
             ))
          - (SELECT COALESCE(SUM(amount), 0) FROM commission_requests
             WHERE branch_id = b.id AND status = 'PAID')
        , 2)
    `);

    // 4) agencies.balance'ı aynı mantıkla yeniden hesapla. MySQL, UPDATE
    //    edilen tabloyu FROM alt sorgusunda doğrudan referans almaya izin
    //    vermediği için geçici bir tablo üzerinden JOIN'lenir.
    await queryRunner.query(`DROP TEMPORARY TABLE IF EXISTS _tmp_agency_new_balance_1702200000026`);
    await queryRunner.query(`
      CREATE TEMPORARY TABLE _tmp_agency_new_balance_1702200000026 AS
      SELECT a.id,
        ROUND(
          (SELECT COALESCE(SUM(
              CASE WHEN s.branch_id IS NOT NULL THEN (s.price / 1.20) * (a.commission_rate - b.commission_rate) / 100
                   ELSE (s.price / 1.20) * a.commission_rate / 100 END
            ), 0)
           FROM sales s LEFT JOIN branches b ON b.id = s.branch_id
           WHERE s.agency_id = a.id
             AND NOT EXISTS (
               SELECT 1 FROM payments p
               WHERE p.sale_id = s.id AND p.type = 'BALANCE' AND p.status = 'COMPLETED'
             ))
          - (SELECT COALESCE(SUM(amount), 0) FROM commission_requests
             WHERE agency_id = a.id AND branch_id IS NULL AND status = 'PAID')
        , 2) AS new_balance
      FROM agencies a
    `);
    await queryRunner.query(`
      UPDATE agencies a
      JOIN _tmp_agency_new_balance_1702200000026 n ON n.id = a.id
      SET a.balance = n.new_balance
    `);
    await queryRunner.query(`DROP TEMPORARY TABLE IF EXISTS _tmp_agency_new_balance_1702200000026`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Yedek tablolar yoksa (örn. up() hiç çalışmadıysa) sessizce çık.
    const backupExists: any[] = await queryRunner.query(`
      SELECT COUNT(*) as cnt FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = '_backup_sales_commission_1702200000026'
    `);
    if (!backupExists[0] || Number(backupExists[0].cnt) === 0) {
      return;
    }

    await queryRunner.query(`
      UPDATE sales s
      JOIN _backup_sales_commission_1702200000026 y ON y.id = s.id
      SET s.commission = y.commission,
          s.branch_commission = y.branch_commission,
          s.agency_commission = y.agency_commission
    `);
    await queryRunner.query(`
      UPDATE branches b
      JOIN _backup_branches_balance_1702200000026 y ON y.id = b.id
      SET b.balance = y.balance
    `);
    await queryRunner.query(`
      UPDATE agencies a
      JOIN _backup_agencies_balance_1702200000026 y ON y.id = a.id
      SET a.balance = y.balance
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS _backup_sales_commission_1702200000026`);
    await queryRunner.query(`DROP TABLE IF EXISTS _backup_branches_balance_1702200000026`);
    await queryRunner.query(`DROP TABLE IF EXISTS _backup_agencies_balance_1702200000026`);
  }
}

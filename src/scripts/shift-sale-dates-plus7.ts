/**
 * Eski PDF +7 modeli ile hizalama: sales.start_date / end_date += 7 gün.
 * Bir kez çalıştırın: npx ts-node src/scripts/shift-sale-dates-plus7.ts
 */
import 'dotenv/config';
import { AppDataSource } from '../config/database';

async function main() {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const before = await qr.query(
      `SELECT COUNT(*) AS c FROM sales WHERE start_date IS NOT NULL AND end_date IS NOT NULL`
    );
    console.log('Güncellenecek satış:', before[0]?.c);

    await qr.query(`
      UPDATE sales
      SET
        start_date = DATE_ADD(start_date, INTERVAL 7 DAY),
        end_date = DATE_ADD(end_date, INTERVAL 7 DAY)
      WHERE start_date IS NOT NULL
        AND end_date IS NOT NULL
    `);

    // migrations tablosu (id AUTO_INCREMENT değilse max+1)
    const rows = await qr.query(`SELECT COALESCE(MAX(id), 0) AS maxId FROM migrations`);
    const nextId = Number(rows[0]?.maxId || 0) + 1;
    const existing = await qr.query(
      `SELECT id FROM migrations WHERE timestamp = ? OR name = ? LIMIT 1`,
      [1702200000024, 'ShiftSaleDatesPlus7ForPdfAlign1702200000024']
    );
    if (!existing.length) {
      await qr.query(
        `INSERT INTO migrations (id, timestamp, name) VALUES (?, ?, ?)`,
        [nextId, 1702200000024, 'ShiftSaleDatesPlus7ForPdfAlign1702200000024']
      );
      console.log('migrations kaydı eklendi id=', nextId);
    } else {
      console.log('migrations kaydı zaten var');
    }

    await qr.commitTransaction();
    console.log('OK: sales start/end +7 uygulandı');
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

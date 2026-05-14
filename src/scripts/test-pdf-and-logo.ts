/**
 * Canlı / lokal duman testi:
 * 1) Şube logosu statik dosyası (GET, yazma yok)
 * 2) Public PDF (GET, SMS / INSERT yok)
 *
 * Not: PDF endpoint'i mevcut bir sales.id ister. "Yeni satış açmadan" demek
 * DB'de zaten var olan herhangi bir satışın UUID'si yeterli — bu script
 * sadece SELECT ile bir id bulur veya TEST_SALE_ID kullanır.
 *
 * Kullanım (proje kökünden):
 *   TEST_API_BASE=https://api.example.com NODE_OPTIONS='-r dotenv/config' npx ts-node src/scripts/test-pdf-and-logo.ts
 *   TEST_SALE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx ...  (isteğe bağlı, yoksa son satışlardan biri)
 *
 *   TEST_SALE_ID verirsen DB bağlantısı hiç açılmaz (sadece HTTP).
 *   TEST_LOGO_ONLY=1 sadece logo URL'sini dener.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = (process.env.TEST_API_BASE || `http://127.0.0.1:${process.env.PORT || 3000}`).replace(
  /\/$/,
  ''
);

const LOGO_REL = '/uploads/branch-logo/izmirsoforlorlogo.jpg';

async function fetchBinary(url: string): Promise<{ status: number; body: Buffer; ct: string }> {
  const res = await fetch(url, { method: 'GET' });
  const ab = await res.arrayBuffer();
  return {
    status: res.status,
    body: Buffer.from(ab),
    ct: res.headers.get('content-type') || '',
  };
}

async function pickSaleIdReadOnly(): Promise<string | null> {
  const manual = process.env.TEST_SALE_ID?.trim();
  if (manual) return manual;

  const { AppDataSource } = await import('../config/database');
  await AppDataSource.initialize();
  try {
    const pick = (process.env.TEST_SALE_PICK || 'recent').toLowerCase();
    const sql =
      pick === 'random'
        ? `SELECT id FROM sales ORDER BY RAND() LIMIT 1`
        : `SELECT id FROM sales ORDER BY created_at DESC LIMIT 1`;
    const rows: { id: string }[] = await AppDataSource.query(sql);
    return rows[0]?.id ?? null;
  } finally {
    await AppDataSource.destroy();
  }
}

async function main() {
  const logoOnly = process.env.TEST_LOGO_ONLY === '1';

  const logoUrl = `${API_BASE}${LOGO_REL}`;
  console.log('[1] Logo isteği:', logoUrl);
  const logo = await fetchBinary(logoUrl);
  console.log(
    `    HTTP ${logo.status}, Content-Type: ${logo.ct}, boyut: ${logo.body.length} bayt`
  );
  if (logo.status !== 200 || logo.body.length < 100) {
    console.warn('    Uyarı: Logo beklenen gibi görünmüyor (404 veya boş olabilir).');
  }

  if (logoOnly) {
    console.log('TEST_LOGO_ONLY=1 → PDF adımı atlandı.');
    return;
  }

  const saleId = await pickSaleIdReadOnly();
  if (!saleId) {
    console.error(
      '[2] Satış id yok. DBde sales kaydı yoksa TEST_SALE_ID ortam değişkeni ver.'
    );
    process.exit(1);
  }

  const pdfUrl = `${API_BASE}/api/v1/public/pdf/sale/${saleId}`;
  console.log('[2] PDF isteği (public, SMS yok):', pdfUrl);
  const pdf = await fetchBinary(pdfUrl);
  console.log(`    HTTP ${pdf.status}, Content-Type: ${pdf.ct}, boyut: ${pdf.body.length} bayt`);

  const out = path.join('/tmp', `yol-asist-test-sozlesme-${saleId.slice(0, 8)}.pdf`);
  const head = pdf.body.slice(0, 5).toString('utf8');
  if (pdf.status === 200 && head.startsWith('%PDF')) {
    fs.writeFileSync(out, pdf.body);
    console.log('    PDF dosyaya yazıldı:', out);
  } else {
    console.log('    Gövde önizleme (ilk 400 karakter):');
    console.log(pdf.body.slice(0, 400).toString('utf8'));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

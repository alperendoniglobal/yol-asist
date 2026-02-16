/**
 * cozumasistanlog.svg içindeki gömülü PNG'yi çıkarıp mavi (#1e40af) tonunda
 * cozumasistanlog.png olarak kaydeder. PDF'te bu logo dosyası kullanılır
 * (svg-to-pdfkit filter desteklemediği için SVG doğrudan çizilemez).
 *
 * Kullanım: npm run generate-logo-png
 * (İlk kurulumda veya logo değişince bir kez çalıştırın.)
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const assetsPath = path.join(process.cwd(), 'src/assets');
const svgPath = path.join(assetsPath, 'cozumasistanlog.svg');
const pngPath = path.join(assetsPath, 'cozumasistanlog.png');

// Logo mavi rengi (PDF temasıyla aynı)
const BLUE = { r: 30, g: 64, b: 175 }; // #1e40af

async function main() {
  if (!fs.existsSync(svgPath)) {
    console.error('Dosya bulunamadı:', svgPath);
    process.exit(1);
  }
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const match = svgContent.match(/xlink:href="data:image\/png;base64,([^"]+)"/);
  if (!match) {
    console.error('SVG içinde base64 PNG bulunamadı.');
    process.exit(1);
  }
  const pngBuffer = Buffer.from(match[1], 'base64');
  const img = sharp(pngBuffer);
  const { width = 0, height = 0 } = await img.metadata();
  if (!width || !height) {
    throw new Error('PNG boyutları alınamadı');
  }
  // Logo şeklini (alfa kanalı) koruyup rengi tam mavi yap: beyaz logo -> #1e40af
  // tint() beyazı yeterince koyulaştırmıyor; alfa maskesi ile düz mavi dolduruyoruz
  const alphaBuffer = await img.extractChannel(3).raw().toBuffer();
  const blueRgb = await sharp({
    create: { width, height, channels: 3, background: BLUE },
  })
    .raw()
    .toBuffer();
  const bluePng = await sharp(blueRgb, { raw: { width, height, channels: 3 } })
    .joinChannel(alphaBuffer, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  fs.writeFileSync(pngPath, bluePng);
  console.log('Logo PNG oluşturuldu (mavi):', pngPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Sale } from '../entities/Sale';
import { AppDataSource } from '../config/database';
import { Package } from '../entities/Package';
import { PackageCover } from '../entities/PackageCover';
import { VehicleService } from './VehicleService';
import { staticFilesPath } from '../middlewares/uploadMiddleware';

// SVG to PDFKit için
const SVGtoPDF = require('svg-to-pdfkit');

export type PdfPalette = {
  primary: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  success: string;
  background: string;
  cardBg: string;
  border: string;
  text: string;
  textLight: string;
};

const DEFAULT_PDF_PALETTE: PdfPalette = {
  primary: '#1e40af',
  primaryLight: '#3b82f6',
  secondary: '#64748b',
  accent: '#0ea5e9',
  success: '#22c55e',
  background: '#f8fafc',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  textLight: '#64748b',
};

/** branches.pdf_logo_path dolu ve dosya bulunduğunda — mavi dışı nötr palet */
const BRANCH_CUSTOM_LOGO_PALETTE: PdfPalette = {
  primary: '#1c1917',
  primaryLight: '#44403c',
  secondary: '#78716c',
  accent: '#a8a29e',
  success: '#15803d',
  background: '#fafaf9',
  cardBg: '#ffffff',
  border: '#d6d3d1',
  text: '#1c1917',
  textLight: '#57534e',
};

/**
 * PDF Oluşturma Servisi - Modern Tasarım
 * Satış tamamlandıktan sonra profesyonel sözleşme belgesi oluşturur
 */
export class PdfService {
  private saleRepository = AppDataSource.getRepository(Sale);
  private packageRepository = AppDataSource.getRepository(Package);
  private coverRepository = AppDataSource.getRepository(PackageCover);
  private vehicleService = new VehicleService();

  // Font ve asset yolları
  private fontPath = path.join(process.cwd(), 'src/assets/fonts');
  private assetsPath = path.join(process.cwd(), 'src/assets');

  /**
   * branches.pdf_logo_path: public altındaki dosya (örn. /uploads/branch-logo/x.jpg).
   * Express /uploads → public kökü; diskte public/branch-logo/x.jpg.
   */
  private resolveLogoDiskPath(stored: string | null | undefined): string | null {
    if (stored == null || typeof stored !== 'string') return null;
    const raw = stored.trim();
    if (!raw || /^https?:\/\//i.test(raw)) return null;

    let rel = raw.replace(/^\/+/, '');
    if (rel.toLowerCase().startsWith('uploads/')) {
      rel = rel.slice('uploads/'.length);
    }

    const full = path.join(staticFilesPath, rel);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Satış için PDF sözleşme belgesi oluşturur
   */
  async generateSaleContract(saleId: string): Promise<Buffer> {
    const sale = await this.saleRepository.findOne({
      where: { id: saleId },
      relations: ['customer', 'vehicle', 'package', 'agency', 'branch', 'user', 'vehicle.brand', 'vehicle.model', 'vehicle.motorBrand', 'vehicle.motorModel'],
    });

    if (!sale) {
      throw new Error('Satış bulunamadı');
    }

    // Vehicle'ı normalize et - brand ve model her zaman gelsin
    if (sale.vehicle) {
      sale.vehicle = this.vehicleService.normalizeVehicle(sale.vehicle) as any;
    }

    const covers = await this.coverRepository.find({
      where: { package_id: sale.package_id },
      order: { sort_order: 'ASC' },
    });

    const customLogoDiskPath = this.resolveLogoDiskPath(sale.branch?.pdf_logo_path ?? null);
    const palette: PdfPalette = customLogoDiskPath
      ? { ...BRANCH_CUSTOM_LOGO_PALETTE }
      : { ...DEFAULT_PDF_PALETTE };

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Yol Yardım Sözleşmesi - ${sale.id.slice(0, 8).toUpperCase()}`,
          Author: 'Çözüm Asistan',
        },
      });

      // Font yükleme
      const notoRegular = path.join(this.fontPath, 'NotoSans-Regular.ttf');
      const notoBold = path.join(this.fontPath, 'NotoSans-Bold.ttf');

      let defaultFont = 'Helvetica';
      let boldFont = 'Helvetica-Bold';

      try {
        if (fs.existsSync(notoRegular)) {
          doc.registerFont('NotoSans', fs.readFileSync(notoRegular));
          defaultFont = 'NotoSans';
        }
        if (fs.existsSync(notoBold)) {
          doc.registerFont('NotoSans-Bold', fs.readFileSync(notoBold));
          boldFont = 'NotoSans-Bold';
        }
      } catch (e) {
        console.error('Font yükleme hatası:', e);
      }

      doc.font(defaultFont);
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = 515;
      let y = 40;

      // ==================== HEADER BANDI ====================
      doc.rect(0, 0, 595, 100).fill(palette.primary);

      doc.font(boldFont).fontSize(10).fillColor('#fff')
        .text('7/24 ÇAĞRI DESTEK', 400, 8, { width: 155, align: 'right' });
      doc.font(defaultFont).fontSize(9).fillColor('#fff')
        .text('+90 (850) 304 54 40', 400, 20, { width: 155, align: 'right' });

      doc.roundedRect(30, 35, 200, 60, 5).fill('#fff');

      const logoPngPath = path.join(this.assetsPath, 'cozumasistanlog.png');
      let logoDrawn = false;

      if (customLogoDiskPath) {
        try {
          doc.image(customLogoDiskPath, 40, 45, { fit: [180, 45], align: 'center', valign: 'center' });
          logoDrawn = true;
        } catch (e) {
          console.error('Şube PDF logosu hatası:', e);
        }
      }

      if (!logoDrawn && fs.existsSync(logoPngPath)) {
        try {
          doc.image(logoPngPath, 40, 45, { width: 180, height: 45 });
          logoDrawn = true;
        } catch (e) {
          console.error('Logo PNG hatası:', e);
        }
      }

      if (!logoDrawn) {
        const logoSvgPath = path.join(this.assetsPath, 'cozumasistanlogaa.svg');
        if (fs.existsSync(logoSvgPath)) {
          try {
            const svgContent = fs.readFileSync(logoSvgPath, 'utf8');
            const svgColored = svgContent.replace(/fill:\s*#fff/gi, `fill: ${palette.primary}`);
            SVGtoPDF(doc, svgColored, 40, 45, { width: 180, height: 45 });
            logoDrawn = true;
          } catch (e) {
            console.error('Logo SVG hatası:', e);
          }
        }
      }

      if (!logoDrawn) {
        doc.font(boldFont).fontSize(18).fillColor(palette.primary).text('ÇÖZÜM ASİSTAN', 45, 50);
        doc.font(defaultFont).fontSize(8).fillColor(palette.textLight).text('Yol Yardım Hizmetleri', 45, 70);
      }

      y = 115;

      const customer = sale.customer;
      const vehicle = sale.vehicle;
      const pkg = sale.package;

      const col1X = 40;
      const col2X = 300;
      const cardWidth = 240;

      this.drawCard(doc, col1X, y, cardWidth, 130, 'HİZMET ALAN ÜYE BİLGİLERİ ', boldFont, palette);
      let cardY = y + 30;
      doc.font(defaultFont).fontSize(9).fillColor(palette.text);

      if (customer) {
        if (customer.is_corporate) {
          this.drawFieldInline(doc, col1X + 10, cardY, 'Ünvan', customer.name, defaultFont, palette);
          cardY += 15;
          this.drawFieldInline(doc, col1X + 10, cardY, 'Vergi No', customer.tc_vkn, defaultFont, palette);
          cardY += 15;
          this.drawFieldInline(doc, col1X + 10, cardY, 'Vergi Dairesi', customer.tax_office || '-', defaultFont, palette);
        } else {
          this.drawFieldInline(doc, col1X + 10, cardY, 'Ad Soyad', `${customer.name} ${customer.surname || ''}`, defaultFont, palette);
          cardY += 15;
          this.drawFieldInline(doc, col1X + 10, cardY, 'T.C. Kimlik', customer.tc_vkn, defaultFont, palette);
          cardY += 15;
          this.drawFieldInline(doc, col1X + 10, cardY, 'Doğum Tarihi', customer.birth_date ? this.formatDate(customer.birth_date) : '-', defaultFont, palette);
        }
        cardY += 15;
        this.drawFieldInline(doc, col1X + 10, cardY, 'Telefon', customer.phone, defaultFont, palette);
        cardY += 15;
        this.drawFieldInline(doc, col1X + 10, cardY, 'E-Posta', customer.email || '-', defaultFont, palette);
        cardY += 15;
        if (customer.city) {
          this.drawFieldInline(doc, col1X + 10, cardY, 'Adres', `${customer.district || ''} / ${customer.city}`, defaultFont, palette);
        }
      }

      this.drawCard(doc, col2X, y, cardWidth, 130, 'ARAÇ BİLGİLERİ', boldFont, palette);
      cardY = y + 30;

      if (vehicle) {
        const brandName = vehicle.brand?.name || '-';
        const modelName = vehicle.model?.name || '-';

        this.drawFieldInline(doc, col2X + 10, cardY, 'Plaka', vehicle.plate + (vehicle.is_foreign_plate ? ' (Yabancı)' : ''), defaultFont, palette);
        cardY += 15;
        this.drawFieldInline(doc, col2X + 10, cardY, 'Marka', brandName, defaultFont, palette);
        cardY += 15;
        this.drawFieldInline(doc, col2X + 10, cardY, 'Model', modelName.length > 18 ? modelName.slice(0, 18) + '...' : modelName, defaultFont, palette);
        cardY += 15;
        this.drawFieldInline(doc, col2X + 10, cardY, 'Model Yılı', vehicle.model_year.toString(), defaultFont, palette);
        cardY += 15;
        this.drawFieldInline(doc, col2X + 10, cardY, 'Kullanım', this.getUsageTypeLabel(vehicle.usage_type), defaultFont, palette);
        if (vehicle.registration_serial) {
          cardY += 15;
          this.drawFieldInline(doc, col2X + 10, cardY, 'Ruhsat', `${vehicle.registration_serial} / ${vehicle.registration_number || ''}`, defaultFont, palette);
        }
      }

      y += 145;

      const startDateDisplay = new Date(sale.start_date);
      startDateDisplay.setDate(startDateDisplay.getDate() + 7);
      const endDateDisplay = new Date(sale.end_date);
      endDateDisplay.setDate(endDateDisplay.getDate() + 7);
      const tanzimDate = sale.created_at instanceof Date
        ? new Date(sale.created_at)
        : sale.created_at
          ? new Date(sale.created_at)
          : new Date();
      tanzimDate.setDate(tanzimDate.getDate() + 7);

      const coversHeight = 30 + (covers.length * 14) + 30;
      const secondRowCardHeight = Math.max(130, coversHeight);

      this.drawCard(doc, col1X, y, cardWidth, secondRowCardHeight, 'HİZMET BİLGİLERİ', boldFont, palette);
      cardY = y + 30;
      doc.font(defaultFont).fontSize(9).fillColor(palette.text);
      doc.text(`Hizmet No: ${sale.id.slice(0, 8).toUpperCase()}`, col1X + 10, cardY);
      cardY += 15;
      doc.text(`Tanzim: ${this.formatDateTime(tanzimDate)}`, col1X + 10, cardY);
      cardY += 15;
      doc.text(`Başlangıç: ${this.formatDateTime(startDateDisplay)}`, col1X + 10, cardY);
      cardY += 15;
      doc.text(`Bitiş: ${this.formatDateTime(endDateDisplay)}`, col1X + 10, cardY);

      this.drawCard(doc, col2X, y, cardWidth, secondRowCardHeight, 'PAKET BİLGİLERİ', boldFont, palette);
      cardY = y + 30;

      if (pkg) {
        doc.font(boldFont).fontSize(10).fillColor(palette.primary)
          .text(pkg.name, col2X + 10, cardY);
        cardY += 16;
        doc.font(defaultFont).fontSize(8).fillColor(palette.textLight)
          .text(`${pkg.vehicle_type} | Maks. ${pkg.max_vehicle_age} yaş`, col2X + 10, cardY);
        cardY += 20;

        doc.font(defaultFont).fontSize(8).fillColor(palette.text);
        for (const cover of covers) {
          const limitText = Number(cover.limit_amount) > 0
            ? ` (${this.formatCurrency(Number(cover.limit_amount))} TL)`
            : '';
          doc.text(`• ${cover.usage_count}x ${cover.title}${limitText}`, col2X + 10, cardY, { width: cardWidth - 20 });
          cardY += 12;
        }
      }

      y += secondRowCardHeight + 15;

      doc.roundedRect(col1X, y, pageWidth, 60, 5)
        .fillAndStroke(palette.background, palette.border);

      doc.rect(col1X, y, pageWidth, 22).fill(palette.primary);
      doc.font(boldFont).fontSize(10).fillColor('#fff')
        .text('FİYAT BİLGİSİ', col1X + 15, y + 6);

      const price = Number(sale.price) || 0;
      const kdvRate = 0.20;
      const netPrice = price / (1 + kdvRate);
      const kdv = price - netPrice;

      doc.font(defaultFont).fontSize(9).fillColor(palette.text);
      const priceY = y + 32;

      doc.text('Net Tutar:', col1X + 15, priceY);
      doc.font(boldFont).text(`${this.formatCurrency(netPrice)} TL`, col1X + 80, priceY);

      doc.font(defaultFont).text('KDV (%20):', col1X + 180, priceY);
      doc.font(boldFont).text(`${this.formatCurrency(kdv)} TL`, col1X + 245, priceY);

      doc.font(defaultFont).text('TOPLAM:', col1X + 350, priceY);
      doc.font(boldFont).fontSize(12).fillColor(palette.primary)
        .text(`${this.formatCurrency(price)} TL`, col1X + 410, priceY - 2);

      y += 75;

      doc.font(defaultFont).fontSize(7).fillColor(palette.textLight)
        .text('Hizmetimiz Türkiye genelinde 7/24 sağlanmaktadır. Detaylı bilgi için sözleşme şartlarını inceleyiniz.', col1X, y, { width: pageWidth, align: 'center' });

      doc.addPage();
      y = 40;

      doc.rect(0, 0, 595, 50).fill(palette.primary);
      doc.font(boldFont).fontSize(16).fillColor('#fff')
        .text('HİZMET ŞARTLARI VE KOŞULLARI', 40, 18);

      y = 65;
      doc.font(defaultFont).fontSize(9).fillColor(palette.text);

      const terms = [
        { title: 'HİZMET TANIMLARI', items: [
          'Kaza Durumunda: Aracın bir kaza sonucu hareketsiz kalması durumunda yürür hale getirilmesi ya da en yakın servis/tamirhaneye götürülmesi için gerekli organizasyon sağlanacaktır. (Limitler dahilinde)',
          'Aracın Arızalanması Durumunda: Aracın hareketsiz kalmasına yol açan veya güvenli sürüşü engelleyen arıza durumunda, en yakın servise/tamirhaneye çekim sağlanır. (Limitler dahilinde)',
          'Lastik Patlaması: Aracın sağlıklı sürüşünü etkileyen bir lastik hasarı sonucu en yakın lastikçiye götürülmesi için gerekli organizasyon sağlanacaktır. (Limitler dahilinde)',
          'Yakıt Bitmesi/Şarj Bitmesi: Fosil yakıtlı araçlarda yakıt bitmesi ya da elektrik motorlu araçlarda pil bitmesi sonucu hareketsiz kalması sonucu en yakın ilgili istasyona çekim sağlanır. (Limitler dahilinde)',
        ]},
        { title: 'GENEL ŞARTLAR', items: [
          'a) İş bu hizmet sözleşmesi tanzim tarihinden 7 gün sonra geçerli olacaktır. 7 gün bekleme süresi vardır.',
          'b) Hizmetlerden yalnızca çağrı merkezimize iletilen taleplere destek sağlanacaktır.',
          'c) Sözleşmenin ilk sayfasında belirtilen limitler dahilinde çekme/kurtarma işlemi en yakın servis/tamirhaneye kadar çekim hizmeti verilir.',
          'd) Paket limit aşımları ve bu aşımdan kaynaklı köprü/otoyol/otopark ücretleri müşteri tarafından karşılanır.',
          'e) Aracın emtia (yükünden) dolayı çekme/kurtarma işlemi yapılamıyorsa yükün boşaltılmasından ÇÖZÜM ASİSTAN firması sorumlu değildir. Ancak araçta bulunan Emtia ile çekme/kurtarma teknik olarak mümkünse müşterinin yazılı onayı ile çekim yapılacaktır ve bu çekimden dolayı emtia ve araçta oluşabilecek hasarlardan "ÇÖZÜM ASİSTAN" sorumlu değildir.',
          'f) Ağır ticari araç gruplarında her durumda sadece motorlu araç(kupa) için hizmet verilir.',
        ]},
        { title: 'KAPSAM DIŞI DURUMLAR', items: [
          'Aracın çamura saplanması, farlarının aydınlatmaması, cam silgiclerinin çalışmaması',
          'Mazot ve motor donması, aracın karlı ve yağışlı havalarda yolda ilerleyemiyor olması',
          'Müşterinin oto tamirhane dışındaki başka bir adrese çekim talepleri',
          'Römork, Treyler, Dorse vb eklentilere teminat verilmeyecektir',
          'Yurtdışında çekme/kurtarma hizmeti kullanılamaz',
          'Aynı olayda birden fazla çekici hizmeti kullanılamaz',
          'Coğrafi şartlardan dolayı çekme/kurtarma mümkün değilse hizmet talebi kapsam dışıdır',
          'Sel, deprem, volkanik patlama, fırtına, terör, isyan, ayaklanma, savaş ve halk hareketleri sonucu oluşacak talepler hizmet kapsamı dışındadır',
        ]},
        { title: 'SÖZLEŞME İPTAL ŞARTLARI', items: [
          'a) Sözleşme 7 gün içerisinde başlangıcından iptal edilebilir',
          'b) 7 günden sonra gelen iptal taleplerinde banka tahsilat komisyonu kesilerek gün esaslı iptal yapılır',
          'c) Sözleşme süresi içerisinde 3 ve üzerinde çekim talebi gelmesi durumunda sözleşme bedelsiz olarak otomatik iptal edilir',
          'd) Herhangi bir hizmet kullanımı olan sözleşmelerde iptal talebi gelmesi durumunda ücret iadesi yapılmaz',
        ]},
      ];

      for (const section of terms) {
        doc.font(boldFont).fontSize(10).fillColor(palette.primary)
          .text(section.title, 40, y);
        y += 18;

        doc.font(defaultFont).fontSize(8).fillColor(palette.text);
        for (const item of section.items) {
          const textHeight = doc.heightOfString(`• ${item}`, { width: pageWidth - 20 });
          doc.text(`• ${item}`, 50, y, { width: pageWidth - 20 });
          y += textHeight + 4;
        }

        if (section.title === 'KAPSAM DIŞI DURUMLAR' || section.title === 'SÖZLEŞME İPTAL ŞARTLARI') {
          y += 8;
          doc.font(defaultFont).fontSize(8).fillColor(palette.text)
            .text('Yukarıdaki maddeler sözleşme tarafları arasında peşinen kabul edilmiştir.', 50, y, { width: pageWidth - 20 });
          y += 12;
        }

        y += 12;

        if (y > 750) {
          doc.addPage();
          y = 40;
        }
      }

      doc.font(defaultFont).fontSize(8).fillColor(palette.textLight)
        .text('Bu belge elektronik ortamda oluşturulmuştur.', 40, 770, { width: pageWidth, align: 'center' })
        .text(`Oluşturma Tarihi: ${this.formatDateTime(new Date())}`, 40, 782, { width: pageWidth, align: 'center' });

      doc.end();
    });
  }

  private drawCard(
    doc: any,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    boldFont: string,
    palette: PdfPalette
  ) {
    doc.roundedRect(x, y, width, height, 5)
      .fillAndStroke(palette.cardBg, palette.border);

    doc.rect(x, y, width, 22).fill(palette.primary);
    doc.roundedRect(x, y, width, 22, 5).fill(palette.primary);
    doc.rect(x, y + 10, width, 12).fill(palette.primary);

    doc.font(boldFont).fontSize(9).fillColor('#fff')
      .text(title, x + 10, y + 6);
  }

  private drawFieldInline(
    doc: any,
    x: number,
    y: number,
    label: string,
    value: string,
    font: string,
    palette: PdfPalette
  ) {
    doc.font(font).fontSize(9).fillColor(palette.textLight)
      .text(`${label}: `, x, y, { continued: true })
      .fillColor(palette.text)
      .text(value);
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatCurrency(value: number): string {
    return value.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private getUsageTypeLabel(type: string): string {
    switch (type) {
      case 'PRIVATE': return 'Hususi';
      case 'COMMERCIAL': return 'Ticari';
      case 'TAXI': return 'Taksi';
      default: return type;
    }
  }
}

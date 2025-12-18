import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Sale } from '../entities/Sale';
import { AppDataSource } from '../config/database';
import { Package } from '../entities/Package';
import { PackageCover } from '../entities/PackageCover';

// SVG to PDFKit için
const SVGtoPDF = require('svg-to-pdfkit');

/**
 * PDF Oluşturma Servisi - Modern Tasarım
 * Satış tamamlandıktan sonra profesyonel poliçe belgesi oluşturur
 */
export class PdfService {
  private saleRepository = AppDataSource.getRepository(Sale);
  private packageRepository = AppDataSource.getRepository(Package);
  private coverRepository = AppDataSource.getRepository(PackageCover);

  // Font ve asset yolları
  private fontPath = path.join(process.cwd(), 'src/assets/fonts');
  private assetsPath = path.join(process.cwd(), 'src/assets');

  // Renk paleti
  private colors = {
    primary: '#1e40af',      // Koyu mavi
    primaryLight: '#3b82f6', // Açık mavi
    secondary: '#64748b',    // Gri
    accent: '#0ea5e9',       // Cyan
    success: '#22c55e',      // Yeşil
    background: '#f8fafc',   // Açık gri arka plan
    cardBg: '#ffffff',       // Kart arka planı
    border: '#e2e8f0',       // Border rengi
    text: '#1e293b',         // Ana metin
    textLight: '#64748b',    // Açık metin
  };

  /**
   * Satış için PDF poliçe belgesi oluşturur
   */
  async generateSaleContract(saleId: string): Promise<Buffer> {
    const sale = await this.saleRepository.findOne({
      where: { id: saleId },
      relations: ['customer', 'vehicle', 'package', 'agency', 'branch', 'user', 'vehicle.brand', 'vehicle.model'],
    });

    if (!sale) {
      throw new Error('Satış bulunamadı');
    }

    const covers = await this.coverRepository.find({
      where: { package_id: sale.package_id },
      order: { sort_order: 'ASC' },
    });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        info: {
          Title: `Yol Yardım Sözleşmesi - ${sale.id.slice(0, 8).toUpperCase()}`,
          Author: 'Çözüm Asistan',
        }
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
      // Mavi gradient header bandı
      doc.rect(0, 0, 595, 100).fill(this.colors.primary);
      
      // Logo kutusu - beyaz arka plan üzerinde mavi logo
      doc.roundedRect(30, 15, 200, 70, 5).fill('#fff');
      
      const logoPath = path.join(this.assetsPath, 'cozumasistanlog.svg');
      let logoDrawn = false;
      
      if (fs.existsSync(logoPath)) {
        try {
          const svgContent = fs.readFileSync(logoPath, 'utf8');
          // Logo rengini maviye çevir (#fff -> #1e40af)
          const svgBlue = svgContent.replace(/fill:\s*#fff/g, 'fill: #1e40af');
          SVGtoPDF(doc, svgBlue, 40, 25, { width: 180, height: 50 });
          logoDrawn = true;
          console.log('Logo SVG çizildi (mavi)');
        } catch (e) {
          console.error('Logo SVG hatası:', e);
          logoDrawn = false;
        }
      }
      
      // Logo çizilemezse metin olarak yaz
      if (!logoDrawn) {
        doc.font(boldFont).fontSize(20).fillColor(this.colors.primary).text('ÇÖZÜM ASİSTAN', 45, 30);
        doc.font(defaultFont).fontSize(9).fillColor(this.colors.textLight).text('Yol Yardım Hizmetleri', 45, 55);
      }

      // Sağ üst köşe - Satış bilgileri kutusu
      doc.roundedRect(350, 15, 205, 70, 5).fill('#fff');
      doc.font(boldFont).fontSize(9).fillColor(this.colors.primary)
         .text('SATIŞ BİLGİLERİ', 360, 22);
      doc.font(defaultFont).fontSize(8).fillColor(this.colors.text);
      doc.text(`Satış No: ${sale.id.slice(0, 8).toUpperCase()}`, 360, 38);
      doc.text(`Tanzim: ${this.formatDate(sale.created_at)}`, 360, 50);
      doc.text(`Başlangıç: ${this.formatDate(sale.start_date)}`, 360, 62);
      doc.text(`Bitiş: ${this.formatDate(sale.end_date)}`, 460, 62);

      y = 115;

      // ==================== ANA İÇERİK ====================
      const customer = sale.customer;
      const vehicle = sale.vehicle;
      const agency = sale.agency;
      const branch = sale.branch;
      const user = sale.user;
      const pkg = sale.package;

      // İki sütunlu layout
      const col1X = 40;
      const col2X = 300;
      const cardWidth = 240;

      // ---------- SİGORTALI BİLGİLERİ KARTI ----------
      this.drawCard(doc, col1X, y, cardWidth, 130, 'SİGORTALI BİLGİLERİ', boldFont);
      let cardY = y + 30;
      doc.font(defaultFont).fontSize(9).fillColor(this.colors.text);
      
      if (customer) {
        if (customer.is_corporate) {
          this.drawFieldInline(doc, col1X + 10, cardY, 'Ünvan', customer.name, defaultFont);
          cardY += 15;
          this.drawFieldInline(doc, col1X + 10, cardY, 'Vergi No', customer.tc_vkn, defaultFont);
          cardY += 15;
          this.drawFieldInline(doc, col1X + 10, cardY, 'Vergi Dairesi', customer.tax_office || '-', defaultFont);
        } else {
          this.drawFieldInline(doc, col1X + 10, cardY, 'Ad Soyad', `${customer.name} ${customer.surname || ''}`, defaultFont);
          cardY += 15;
          this.drawFieldInline(doc, col1X + 10, cardY, 'T.C. Kimlik', customer.tc_vkn, defaultFont);
          cardY += 15;
          this.drawFieldInline(doc, col1X + 10, cardY, 'Doğum Tarihi', customer.birth_date ? this.formatDate(customer.birth_date) : '-', defaultFont);
        }
        cardY += 15;
        this.drawFieldInline(doc, col1X + 10, cardY, 'Telefon', customer.phone, defaultFont);
        cardY += 15;
        this.drawFieldInline(doc, col1X + 10, cardY, 'E-Posta', customer.email || '-', defaultFont);
        cardY += 15;
        if (customer.city) {
          this.drawFieldInline(doc, col1X + 10, cardY, 'Adres', `${customer.district || ''} / ${customer.city}`, defaultFont);
        }
      }

      // ---------- ARAÇ BİLGİLERİ KARTI ----------
      this.drawCard(doc, col2X, y, cardWidth, 130, 'ARAÇ BİLGİLERİ', boldFont);
      cardY = y + 30;
      
      if (vehicle) {
        const brandName = vehicle.brand?.name || '-';
        const modelName = vehicle.model?.name || '-';
        
        this.drawFieldInline(doc, col2X + 10, cardY, 'Plaka', vehicle.plate + (vehicle.is_foreign_plate ? ' (Yabancı)' : ''), defaultFont);
        cardY += 15;
        this.drawFieldInline(doc, col2X + 10, cardY, 'Marka', brandName, defaultFont);
        cardY += 15;
        this.drawFieldInline(doc, col2X + 10, cardY, 'Model', modelName.length > 18 ? modelName.slice(0, 18) + '...' : modelName, defaultFont);
        cardY += 15;
        this.drawFieldInline(doc, col2X + 10, cardY, 'Model Yılı', vehicle.model_year.toString(), defaultFont);
        cardY += 15;
        this.drawFieldInline(doc, col2X + 10, cardY, 'Kullanım', this.getUsageTypeLabel(vehicle.usage_type), defaultFont);
        if (vehicle.registration_serial) {
          cardY += 15;
          this.drawFieldInline(doc, col2X + 10, cardY, 'Ruhsat', `${vehicle.registration_serial} / ${vehicle.registration_number || ''}`, defaultFont);
        }
      }

      y += 145;

      // ---------- ACENTE BİLGİLERİ KARTI ----------
      this.drawCard(doc, col1X, y, cardWidth, 85, 'ACENTE BİLGİLERİ', boldFont);
      cardY = y + 30;
      
      if (agency) {
        this.drawFieldInline(doc, col1X + 10, cardY, 'Acente', agency.name, defaultFont);
        cardY += 15;
      }
      if (branch) {
        this.drawFieldInline(doc, col1X + 10, cardY, 'Şube', branch.name, defaultFont);
        cardY += 15;
      }
      if (user) {
        this.drawFieldInline(doc, col1X + 10, cardY, 'Temsilci', `${user.name} ${user.surname || ''}`, defaultFont);
        cardY += 15;
      }
      if (agency?.phone) {
        this.drawFieldInline(doc, col1X + 10, cardY, 'Telefon', agency.phone, defaultFont);
      }

      // ---------- PAKET BİLGİLERİ KARTI ----------
      const coversHeight = 30 + (covers.length * 14) + 30;
      this.drawCard(doc, col2X, y, cardWidth, Math.max(85, coversHeight), 'PAKET BİLGİLERİ', boldFont);
      cardY = y + 30;
      
      if (pkg) {
        doc.font(boldFont).fontSize(10).fillColor(this.colors.primary)
           .text(pkg.name, col2X + 10, cardY);
        cardY += 16;
        doc.font(defaultFont).fontSize(8).fillColor(this.colors.textLight)
           .text(`${pkg.vehicle_type} | Maks. ${pkg.max_vehicle_age} yaş`, col2X + 10, cardY);
        cardY += 20;

        // Paket kapsamları
        doc.font(defaultFont).fontSize(8).fillColor(this.colors.text);
        for (const cover of covers) {
          const limitText = Number(cover.limit_amount) > 0 
            ? ` (${this.formatCurrency(Number(cover.limit_amount))} TL)` 
            : '';
          doc.text(`• ${cover.usage_count}x ${cover.title}${limitText}`, col2X + 10, cardY, { width: cardWidth - 20 });
          cardY += 12;
        }
      }

      y += Math.max(100, coversHeight + 15);

      // ==================== FİYAT TABLOSU ====================
      // Tam genişlikte fiyat kartı
      doc.roundedRect(col1X, y, pageWidth, 60, 5)
         .fillAndStroke(this.colors.background, this.colors.border);
      
      // Başlık bandı
      doc.rect(col1X, y, pageWidth, 22).fill(this.colors.primary);
      doc.font(boldFont).fontSize(10).fillColor('#fff')
         .text('FİYAT BİLGİSİ', col1X + 15, y + 6);

      // Fiyat değerleri
      const price = Number(sale.price) || 0;
      const kdvRate = 0.20;
      const netPrice = price / (1 + kdvRate);
      const kdv = price - netPrice;

      doc.font(defaultFont).fontSize(9).fillColor(this.colors.text);
      const priceY = y + 32;
      
      // Net Tutar
      doc.text('Net Tutar:', col1X + 15, priceY);
      doc.font(boldFont).text(`${this.formatCurrency(netPrice)} TL`, col1X + 80, priceY);
      
      // KDV
      doc.font(defaultFont).text('KDV (%20):', col1X + 180, priceY);
      doc.font(boldFont).text(`${this.formatCurrency(kdv)} TL`, col1X + 245, priceY);
      
      // Toplam
      doc.font(defaultFont).text('TOPLAM:', col1X + 350, priceY);
      doc.font(boldFont).fontSize(12).fillColor(this.colors.primary)
         .text(`${this.formatCurrency(price)} TL`, col1X + 410, priceY - 2);

      y += 75;

      // ==================== ALT BİLGİ ====================
      doc.font(defaultFont).fontSize(7).fillColor(this.colors.textLight)
         .text('Hizmetimiz Türkiye genelinde 7/24 sağlanmaktadır. Detaylı bilgi için sözleşme şartlarını inceleyiniz.', col1X, y, { width: pageWidth, align: 'center' });

      // ==================== SAYFA 2 - HİZMET ŞARTLARI ====================
      doc.addPage();
      y = 40;

      // Başlık bandı
      doc.rect(0, 0, 595, 50).fill(this.colors.primary);
      doc.font(boldFont).fontSize(16).fillColor('#fff')
         .text('HİZMET ŞARTLARI VE KOŞULLARI', 40, 18);

      y = 65;
      doc.font(defaultFont).fontSize(9).fillColor(this.colors.text);

      const terms = [
        { title: 'GENEL ŞARTLAR', items: [
          'Hizmetimiz Türkiye genelinde 7/24 sağlanmaktadır.',
          'Sözleşmenin ilk sayfasında belirtilen limit ve süreler dahilinde hizmet verilir.',
          'Sözleşme yürürlüğe giriş tarihinden itibaren 5 gün sonra geçerli olacaktır.',
          'Hizmetten yararlanacak müşterinin aracı arıza veya kaza nedeni ile ikinci kez çekici hizmeti aynı kaza ya da arıza için verilemeyecektir.',
          'Her çekici hizmet hakkı farklı çekim sebebi olması halinde kullanılabilecektir.',
        ]},
        { title: 'ARAÇ YARDIM HİZMETLERİ', items: [
          'Arıza veya kaza anında aracın çekilmesi hizmeti',
          'Aracın devrilme veya şarampole yuvarlanma nedeniyle hareketsiz kalması durumunda kurtarma hizmeti',
          'Çekme ve kurtarma hizmetleri bölgede anlaşmalı çekici/kurtarıcı firmaların imkanları ölçüsünde sağlanacaktır',
        ]},
        { title: 'KAPSAM DIŞI DURUMLAR', items: [
          'Aracın çamura saplanması, farlarının aydınlatmaması, cam silgiclerinin çalışmaması',
          'Mazot ve motor donması, aracın karlı ve yağışlı havalarda yolda ilerleyemiyor olması',
          'Müşterinin oto tamirhane dışındaki başka bir adrese çekim talepleri',
          'Römork, Treyler, Dorse vb eklentilere teminat verilmeyecektir',
        ]},
        { title: 'İPTAL VE İADE', items: [
          'Sözleşme 14 gün içerisinde iptal edilebilir',
          'Karttan tahsil edilen miktar, banka tahsilat komisyonu kesilerek karta iade edilir',
          'Hizmetten yararlanmış olan sözleşmelerde iptal iade işlemi yapılmaz',
        ]},
      ];

      for (const section of terms) {
        // Bölüm başlığı
        doc.font(boldFont).fontSize(10).fillColor(this.colors.primary)
           .text(section.title, 40, y);
        y += 18;

        // Bölüm içeriği
        doc.font(defaultFont).fontSize(8).fillColor(this.colors.text);
        for (const item of section.items) {
          const textHeight = doc.heightOfString(`• ${item}`, { width: pageWidth });
          doc.text(`• ${item}`, 50, y, { width: pageWidth - 20 });
          y += textHeight + 4;
        }
        y += 12;
      }

      // ==================== FOOTER ====================
      doc.font(defaultFont).fontSize(8).fillColor(this.colors.textLight)
         .text('Bu belge elektronik ortamda oluşturulmuştur.', 40, 770, { width: pageWidth, align: 'center' })
         .text(`Oluşturma Tarihi: ${this.formatDateTime(new Date())}`, 40, 782, { width: pageWidth, align: 'center' });

      doc.end();
    });
  }

  // Yardımcı fonksiyon: Kart çizimi
  private drawCard(doc: any, x: number, y: number, width: number, height: number, title: string, boldFont: string) {
    // Kart arka planı
    doc.roundedRect(x, y, width, height, 5)
       .fillAndStroke(this.colors.cardBg, this.colors.border);
    
    // Başlık bandı
    doc.rect(x, y, width, 22).fill(this.colors.primary);
    doc.roundedRect(x, y, width, 22, 5).fill(this.colors.primary);
    // Üst köşeleri yuvarlat, alt köşeler düz
    doc.rect(x, y + 10, width, 12).fill(this.colors.primary);
    
    // Başlık metni
    doc.font(boldFont).fontSize(9).fillColor('#fff')
       .text(title, x + 10, y + 6);
  }

  // Yardımcı fonksiyon: Tek satırda label: value formatında yazma
  private drawFieldInline(doc: any, x: number, y: number, label: string, value: string, font: string) {
    doc.font(font).fontSize(9).fillColor(this.colors.textLight)
       .text(`${label}: `, x, y, { continued: true })
       .fillColor(this.colors.text)
       .text(value);
  }

  // Tarih formatlama
  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // Tarih-saat formatlama
  private formatDateTime(date: Date): string {
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Para formatlama
  private formatCurrency(value: number): string {
    return value.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Kullanım tarzı etiketi
  private getUsageTypeLabel(type: string): string {
    switch (type) {
      case 'PRIVATE': return 'Hususi';
      case 'COMMERCIAL': return 'Ticari';
      case 'TAXI': return 'Taksi';
      default: return type;
    }
  }
}

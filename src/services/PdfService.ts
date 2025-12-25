import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Sale } from '../entities/Sale';
import { AppDataSource } from '../config/database';
import { Package } from '../entities/Package';
import { PackageCover } from '../entities/PackageCover';
import { VehicleService } from './VehicleService';

// SVG to PDFKit için
const SVGtoPDF = require('svg-to-pdfkit');

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
      
      // Acente bilgisini al (logo için)
      const agency = sale.agency;
      
      // Debug: Acente logosu kontrolü
      console.log('Acente bilgisi:', agency ? { id: agency.id, name: agency.name, hasLogo: !!agency.logo, logoLength: agency.logo?.length } : 'Acente yok');
      
      // Sol üst köşe - 7/24 Çağrı Destek (Mavi arka plan üzerine beyaz yazı)
      doc.font(boldFont).fontSize(10).fillColor('#fff')
         .text('7/24 ÇAĞRI DESTEK', 40, 8);
      doc.font(defaultFont).fontSize(9).fillColor('#fff')
         .text('+90 (850) 304 54 40', 40, 20);
      
      // Sol taraf - Çözüm Asistan logosu kutusu
      doc.roundedRect(30, 35, 200, 60, 5).fill('#fff');
      
      const logoPath = path.join(this.assetsPath, 'cozumasistanlog.svg');
      let logoDrawn = false;
      
      if (fs.existsSync(logoPath)) {
        try {
          const svgContent = fs.readFileSync(logoPath, 'utf8');
          // Logo rengini maviye çevir (#fff -> #1e40af)
          const svgBlue = svgContent.replace(/fill:\s*#fff/g, 'fill: #1e40af');
          SVGtoPDF(doc, svgBlue, 40, 45, { width: 180, height: 45 });
          logoDrawn = true;
          console.log('Logo SVG çizildi (mavi)');
        } catch (e) {
          console.error('Logo SVG hatası:', e);
          logoDrawn = false;
        }
      }
      
      // Logo çizilemezse metin olarak yaz
      if (!logoDrawn) {
        doc.font(boldFont).fontSize(18).fillColor(this.colors.primary).text('ÇÖZÜM ASİSTAN', 45, 50);
        doc.font(defaultFont).fontSize(8).fillColor(this.colors.textLight).text('Yol Yardım Hizmetleri', 45, 70);
      }

      // Orta - Acente logosu kutusu (eğer varsa)
      if (agency) {
        if (agency.logo) {
          try {
            // Base64 string'den buffer oluştur
            let base64Data = agency.logo;
            // data:image prefix'i varsa kaldır
            if (base64Data.includes(',')) {
              base64Data = base64Data.split(',')[1];
            }
            const logoBuffer = Buffer.from(base64Data, 'base64');
            
            // Acente logosu kutusu
            doc.roundedRect(250, 35, 80, 60, 5).fill('#fff');
            
            // Base64 resmi PDF'e ekle
            doc.image(logoBuffer, 260, 45, { 
              width: 60, 
              height: 45,
              fit: [60, 45],
              align: 'center',
              valign: 'center'
            });
            
            console.log('✅ Acente logosu PDF\'e eklendi');
          } catch (e) {
            console.error('❌ Acente logosu ekleme hatası:', e);
            // Hata durumunda acente adını yaz
            doc.roundedRect(250, 35, 80, 60, 5).fill('#fff');
            doc.font(defaultFont).fontSize(8).fillColor(this.colors.text)
               .text(agency.name || 'Acente', 255, 60, { width: 70, align: 'center' });
          }
        } else {
          // Logo yoksa acente adını göster
          console.log('⚠️ Acente logosu yok, acente adı gösteriliyor');
          doc.roundedRect(250, 35, 80, 60, 5).fill('#fff');
          doc.font(defaultFont).fontSize(8).fillColor(this.colors.text)
             .text(agency.name || 'Acente', 255, 60, { width: 70, align: 'center' });
        }
      }
      
      // Sağ üst köşe - Satış bilgileri kutusu
      // Acente logosu varsa daha sağa, yoksa normal pozisyonda
      const salesInfoX = (agency && agency.logo) ? 340 : 350;
      const salesInfoWidth = (agency && agency.logo) ? 215 : 205;
      const salesInfoHeight = 80; // Yüksekliği artırdık (4 satır için)
      
      doc.roundedRect(salesInfoX, 35, salesInfoWidth, salesInfoHeight, 5).fill('#fff');
      doc.font(boldFont).fontSize(9).fillColor(this.colors.primary)
         .text('SATIŞ BİLGİLERİ', salesInfoX + 10, 42);
      doc.font(defaultFont).fontSize(7.5).fillColor(this.colors.text);
      doc.text(`Satış No: ${sale.id.slice(0, 8).toUpperCase()}`, salesInfoX + 10, 55);
      // Tanzim tarihi: Satışın gerçekleştiği tarih (sale.created_at) - PDF oluşturulma tarihi değil!
      // sale.created_at zaten bir Date objesi veya string olabilir, güvenli şekilde parse ediyoruz
      const tanzimDate = sale.created_at instanceof Date 
        ? sale.created_at 
        : sale.created_at 
          ? new Date(sale.created_at) 
          : new Date();
      doc.text(`Tanzim: ${this.formatDateTime(tanzimDate)}`, salesInfoX + 10, 66);
      // Başlangıç ve bitiş tarihlerini alt alta yaz
      doc.text(`Başlangıç: ${this.formatDateTime(new Date(sale.start_date))}`, salesInfoX + 10, 77);
      doc.text(`Bitiş: ${this.formatDateTime(new Date(sale.end_date))}`, salesInfoX + 10, 88);

      y = 115;

      // ==================== ANA İÇERİK ====================
      const customer = sale.customer;
      const vehicle = sale.vehicle;
      // agency zaten yukarıda tanımlı (satır 101)
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

      // ---------- KAYNAK BİLGİLERİ KARTI ----------
      this.drawCard(doc, col1X, y, cardWidth, 85, 'KAYNAK BİLGİLERİ', boldFont);
      cardY = y + 30;
      
      if (agency) {
        this.drawFieldInline(doc, col1X + 10, cardY, 'Kaynak', agency.name, defaultFont);
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
        { title: 'HİZMET TANIMLARI', items: [
          'Kaza Durumunda: Aracın bir kaza sonucu hareketsiz kalması durumunda yürür hale getirilmesi ya da en yakın servis/tamirhaneye götürülmesi için gerekli organizasyon sağlanacaktır. (Limitler dahilinde)',
          'Aracın Arızalanması Durumunda: Aracın hareketsiz kalmasına yol açan veya güvenli sürüşü engelleyen arıza durumunda, en yakın servise/tamirhaneye çekim sağlanır. (Limitler dahilinde)',
          'Lastik Patlaması: Aracın sağlıklı sürüşünü etkileyen bir lastik hasarı sonucu en yakın lastikçiye götürülmesi için gerekli organizasyon sağlanacaktır. (Limitler dahilinde)',
          'Yakıt Bitmesi/Şarj Bitmesi: Fosil yakıtlı araçlarda yakıt bitmesi ya da elektrik motorlu araçlarda pil bitmesi sonucu hareketsiz kalması sonucu en yakın ilgili istasyona çekim sağlanır. (Limitler dahilinde)',
        ]},
        { title: 'GENEL ŞARTLAR', items: [
          'Hizmetlerden yalnızca çağrı merkezimize iletilen taleplere destek sağlanacaktır.',
          'b) Sözleşmenin ilk sayfasında belirtilen limitler dahilinde çekme/kurtarma işlemi en yakın servis/tamirhaneye kadar çekim hizmeti verilir.',
          'c) Paket limit aşımları ve bu aşımdan kaynaklı köprü/otoyol/otopark ücretleri sigortalı tarafından karşılanır.',
          'd) Aracın emtia (yükünden) dolayı çekme/kurtarma işlemi yapılamıyorsa yükün boşaltılmasından ÇÖZÜM ASİSTAN firması sorumlu değildir. Ancak araçta bulunan Emtia ile çekme/kurtarma teknik olarak mümkünse sigortalının yazılı onayı ile çekim yapılacaktır ve bu çekimden dolayı emtia ve araçta oluşabilecek hasarlardan "ÇÖZÜM ASİSTAN" sorumlu değildir.',
          'e) Ağır ticari araç gruplarında her durumda sadece motorlu araç(kupa) için hizmet verilir.',
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
          'c) Sözleşme süresi içerisinde 3 ve üzerinde çekim talebi gelmesi durumunda sözleşme primsiz olarak otomatik iptal edilir',
          'd) Herhangi bir hizmet kullanımı olan sözleşmelerde iptal talebi gelmesi durumunda prim iadesi yapılmaz',
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
          const textHeight = doc.heightOfString(`• ${item}`, { width: pageWidth - 20 });
          doc.text(`• ${item}`, 50, y, { width: pageWidth - 20 });
          y += textHeight + 4;
        }
        
        // KAPSAM DIŞI DURUMLAR ve SÖZLEŞME İPTAL ŞARTLARI bölümlerinin sonuna özel metin ekle
        if (section.title === 'KAPSAM DIŞI DURUMLAR' || section.title === 'SÖZLEŞME İPTAL ŞARTLARI') {
          y += 8;
          doc.font(defaultFont).fontSize(8).fillColor(this.colors.text)
             .text('Yukarıdaki maddeler sözleşme tarafları arasında peşinen kabul edilmiştir.', 50, y, { width: pageWidth - 20 });
          y += 12;
        }
        
        y += 12;
        
        // Sayfa sonu kontrolü - eğer sayfa doluyorsa yeni sayfa ekle
        if (y > 750) {
          doc.addPage();
          y = 40;
        }
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

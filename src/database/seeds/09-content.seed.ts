import { AppDataSource } from '../../config/database';
import { LandingPageContent } from '../../entities/LandingPageContent';
import { LandingPageBanner } from '../../entities/LandingPageBanner';
import { LandingPageFeature } from '../../entities/LandingPageFeature';
import { LandingPageStat } from '../../entities/LandingPageStat';
import { PageContent } from '../../entities/PageContent';

/**
 * Landing Page CMS Seed Data
 * Varsayılan içerikler
 */
export const seedContent = async () => {
  const contentRepo = AppDataSource.getRepository(LandingPageContent);
  const bannerRepo = AppDataSource.getRepository(LandingPageBanner);
  const featureRepo = AppDataSource.getRepository(LandingPageFeature);
  const statRepo = AppDataSource.getRepository(LandingPageStat);
  const pageContentRepo = AppDataSource.getRepository(PageContent);

  // ===== LANDING PAGE CONTENT (Genel Ayarlar) =====
  const existingContent = await contentRepo.findOne({ where: {} });
  if (!existingContent) {
    const landingContent = contentRepo.create({
      support_phone: '+90 (850) 304 54 40',
      support_email: 'destek@cozum.net',
      company_name: 'Çözüm Asistan',
      company_address: 'Türkiye',
      meta_title: 'Yol Yardım | 7/24 Çekici Hizmeti | Çözüm Asistan - Türkiye Geneli',
      meta_description: 'Yol yardım hizmetleri Türkiye genelinde 7/24. Yol yardım çekici, tamirci ve acil durum desteği. Yol yardım hizmeti için hemen arayın: 0850 304 54 40.',
      meta_keywords: 'yol yardım, yol yardım hizmeti, yol yardım çekici, yol yardım servisi, 7/24 yol yardım, yol yardım Türkiye, çekici hizmeti, araç kurtarma',
    });
    await contentRepo.save(landingContent);
    console.log('✓ Landing Page Content oluşturuldu');
  }

  // ===== BANNERS =====
  const existingBanners = await bannerRepo.count();
  if (existingBanners === 0) {
    const banners = [
      {
        image_path: '/banner1.jpeg',
        badge: 'Yol Yardım Hizmeti',
        left_content: {
          title: 'Yol Yardım',
          subtitle: '7/24 Yol Yardım Çekici Hizmeti',
          description: 'Yol yardım hizmetleri Türkiye genelinde. Yol yardım çekici, tamirci ve acil durum desteği. Yol yardım hizmeti için hemen arayın.',
          feature: '7/24 Yol Yardım Çekici Hizmeti',
          feature_icon: 'TrendingUp',
        },
        right_content: {
          title: 'Yol Yardım ile Güvende Olun',
          subtitle: '7/24 Yol Yardım Hizmeti',
          description: 'Yol yardım hizmetleri ile araçlarınız için kapsamlı çözümler ve anında yol yardım desteği',
        },
        banner_stats: [
          { label: 'Aktif Kullanıcı', value: 1250, icon: 'Users' },
          { label: 'Toplam Satış', value: 8500, icon: 'ShoppingCart' },
          { label: 'Müşteri Memnuniyeti', value: 98, suffix: '%', icon: 'Star' },
          { label: 'Sistem Uptime', value: 99.9, suffix: '%', icon: 'Activity' },
        ],
        order: 0,
        is_active: true,
      },
      {
        image_path: '/banner2.jpeg',
        badge: 'Güvenilir Çözüm',
        left_content: {
          title: 'Profesyonel Hizmet',
          subtitle: 'Deneyimli Ekip ile Yanınızdayız',
          description: 'Yılların deneyimi ile sigorta sektöründe güvenilir çözümler sunuyoruz. Müşteri memnuniyeti bizim önceliğimizdir.',
          feature: 'Gerçek Zamanlı Raporlama',
          feature_icon: 'BarChart3',
        },
        right_content: {
          title: 'Hızlı ve Güvenilir Hizmet',
          subtitle: 'Profesyonel Ekip',
          description: 'Deneyimli ekibimiz ile her zaman yanınızdayız. 7/24 destek hizmetimiz ile sorunlarınıza anında çözüm buluyoruz.',
        },
        banner_stats: [
          { label: 'Aktif Kaynak', value: 500, icon: 'Users' },
          { label: 'Toplam Şube', value: 1200, icon: 'Package' },
          { label: 'Mutlu Müşteri', value: 50000, icon: 'Star' },
          { label: 'Başarı Oranı', value: 99.5, suffix: '%', icon: 'Activity' },
        ],
        order: 1,
        is_active: true,
      },
      {
        image_path: '/banner3.png',
        badge: 'Yol Yardım',
        left_content: {
          title: '7/24 Destek',
          subtitle: 'Her Zaman Yanınızdayız',
          description: 'Yolda kaldığınızda anında yardım. Profesyonel ekip ve hızlı çözümler ile güvenle yolculuğunuza devam edin.',
          feature: 'Anında Yol Yardımı',
          feature_icon: 'Shield',
        },
        right_content: {
          title: 'Yolda Kaldınız mı?',
          subtitle: 'Hemen Yardım Alın',
          description: '7/24 yol yardım hizmetimiz ile her zaman yanınızdayız. Çekici, tamirci ve acil durum desteği.',
        },
        banner_stats: [
          { label: 'Yardım Çağrısı', value: 15000, icon: 'Activity' },
          { label: 'Ortalama Süre', value: 25, suffix: ' dk', icon: 'Clock' },
          { label: 'Müşteri Memnuniyeti', value: 98.5, suffix: '%', icon: 'Star' },
          { label: 'Aktif Araç', value: 2500, icon: 'Car' },
        ],
        order: 2,
        is_active: true,
      },
    ];

    for (const banner of banners) {
      await bannerRepo.save(bannerRepo.create(banner));
    }
    console.log('✓ Banners oluşturuldu');
  }

  // ===== FEATURES =====
  const existingFeatures = await featureRepo.count();
  if (existingFeatures === 0) {
    const features = [
      {
        icon_name: 'Users',
        title: 'Müşteri Yönetimi',
        description: 'Müşterilerinizi kolayca kaydedin, düzenleyin ve takip edin. Detaylı müşteri bilgileri ve geçmiş kayıtlarına hızlıca erişin.',
        gradient: 'from-blue-500 via-blue-600 to-blue-700',
        order: 0,
        is_active: true,
      },
      {
        icon_name: 'Car',
        title: 'Araç Takibi',
        description: 'Araç bilgilerini sisteme kaydedin, plaka bazlı arama yapın ve araç geçmişini görüntüleyin.',
        gradient: 'from-emerald-500 via-emerald-600 to-teal-700',
        order: 1,
        is_active: true,
      },
      {
        icon_name: 'Package',
        title: 'Paket Yönetimi',
        description: 'Sigorta paketlerini oluşturun, fiyatlandırın ve müşterilerinize sunun. Yaş ve kullanım tipine göre otomatik filtreleme.',
        gradient: 'from-cyan-500 via-cyan-600 to-blue-700',
        order: 2,
        is_active: true,
      },
      {
        icon_name: 'ShoppingCart',
        title: 'Satış Yönetimi',
        description: 'Satış işlemlerini tek ekrandan yönetin. Müşteri, araç ve paket seçimini kolaylaştıran modern arayüz.',
        gradient: 'from-amber-500 via-orange-500 to-red-600',
        order: 3,
        is_active: true,
      },
      {
        icon_name: 'CreditCard',
        title: 'Ödeme Entegrasyonu',
        description: 'Iyzico ile güvenli ödeme alın. Kredi kartı, havale ve bakiye ile ödeme seçenekleri.',
        gradient: 'from-cyan-500 via-cyan-600 to-blue-700',
        order: 4,
        is_active: true,
      },
      {
        icon_name: 'TrendingUp',
        title: 'Raporlama ve İstatistikler',
        description: 'Detaylı dashboard ile satış, gelir ve komisyon istatistiklerinizi görüntüleyin. Grafiklerle verilerinizi analiz edin.',
        gradient: 'from-pink-500 via-rose-600 to-red-700',
        order: 5,
        is_active: true,
      },
    ];

    for (const feature of features) {
      await featureRepo.save(featureRepo.create(feature));
    }
    console.log('✓ Features oluşturuldu');
  }

  // ===== STATS =====
  const existingStats = await statRepo.count();
  if (existingStats === 0) {
    const stats = [
      {
        label: 'Aktif Kaynak',
        value: 500,
        suffix: '+',
        icon_name: 'Users',
        order: 0,
        is_active: true,
      },
      {
        label: 'Toplam Şube',
        value: 1200,
        suffix: '+',
        icon_name: 'Package',
        order: 1,
        is_active: true,
      },
      {
        label: 'Mutlu Müşteri',
        value: 50000,
        suffix: '+',
        icon_name: 'Star',
        order: 2,
        is_active: true,
      },
      {
        label: 'Uptime Oranı',
        value: 99.9,
        suffix: '%',
        icon_name: 'Activity',
        order: 3,
        is_active: true,
      },
    ];

    for (const stat of stats) {
      await statRepo.save(statRepo.create(stat));
    }
    console.log('✓ Stats oluşturuldu');
  }

  // ===== PAGE CONTENTS =====
  const existingPages = await pageContentRepo.count();
  if (existingPages === 0) {
    const pages = [
      {
        slug: 'about',
        title: 'Hakkımızda',
        content: '<h1>Hakkımızda</h1><p>Çözüm Asistan olarak, sigorta sektöründe dijital dönüşümü hızlandırmak için çalışıyoruz.</p>',
        meta_title: 'Hakkımızda | Çözüm Asistan',
        meta_description: 'Çözüm Asistan hakkında bilgiler. Misyonumuz, vizyonumuz ve değerlerimiz.',
        meta_keywords: 'hakkımızda, çözüm asistan, şirket bilgileri',
        is_active: true,
      },
      {
        slug: 'distance-sales-contract',
        title: 'Mesafeli Satış Sözleşmesi',
        content: '<h1>Mesafeli Satış Sözleşmesi</h1><p>Mesafeli satış sözleşmesi şartları ve koşulları.</p>',
        meta_title: 'Mesafeli Satış Sözleşmesi | Çözüm Asistan',
        meta_description: 'Mesafeli satış sözleşmesi şartları ve koşulları. Çözüm Asistan mesafeli satış sözleşmesi.',
        meta_keywords: 'mesafeli satış sözleşmesi, sözleşme şartları',
        is_active: true,
      },
      {
        slug: 'privacy-policy',
        title: 'Gizlilik ve Güvenlik Politikası',
        content: '<h1>Gizlilik ve Güvenlik Politikası</h1><p>Gizlilik ve güvenlik politikamız hakkında bilgiler.</p>',
        meta_title: 'Gizlilik ve Güvenlik Politikası | Çözüm Asistan',
        meta_description: 'Gizlilik ve güvenlik politikamız. Kişisel verilerin korunması ve güvenlik önlemleri.',
        meta_keywords: 'gizlilik politikası, güvenlik politikası, kişisel veri koruma',
        is_active: true,
      },
      {
        slug: 'delivery-return',
        title: 'Teslimat ve İade',
        content: '<h1>Teslimat ve İade</h1><p>Teslimat ve iade şartları hakkında bilgiler.</p>',
        meta_title: 'Teslimat ve İade | Çözüm Asistan',
        meta_description: 'Teslimat ve iade şartları. Ürün teslimat süreleri ve iade koşulları.',
        meta_keywords: 'teslimat, iade, kargo, gönderim',
        is_active: true,
      },
    ];

    for (const page of pages) {
      await pageContentRepo.save(pageContentRepo.create(page));
    }
    console.log('✓ Page Contents oluşturuldu');
  }
};


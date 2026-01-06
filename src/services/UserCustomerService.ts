import { AppDataSource } from '../config/database';
import { UserCustomer } from '../entities/UserCustomer';
import { Vehicle } from '../entities/Vehicle';
import { Sale } from '../entities/Sale';
import { Package } from '../entities/Package';
import { Payment } from '../entities/Payment';
import { hashPassword, comparePassword } from '../utils/hash';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { AppError } from '../middlewares/errorHandler';
import { EntityStatus, UsageType, PaymentStatus, PaymentType } from '../types/enums';
import { PayTRService } from './PayTRService';

/**
 * UserCustomerService
 * Bireysel kullanıcılar için - kayıt, giriş, profil ve satın alma işlemleri
 */
export class UserCustomerService {
  private userCustomerRepository = AppDataSource.getRepository(UserCustomer);
  private vehicleRepository = AppDataSource.getRepository(Vehicle);
  private saleRepository = AppDataSource.getRepository(Sale);
  private packageRepository = AppDataSource.getRepository(Package);
  private paymentRepository = AppDataSource.getRepository(Payment);
  private paytrService = new PayTRService();

  /**
   * Yeni kullanıcı kaydı
   */
  async register(data: {
    tc_vkn: string;
    name: string;
    surname: string;
    email: string;
    phone: string;
    password: string;
    city?: string;
    district?: string;
    address?: string;
  }) {
    // TC kontrolü
    const existingByTc = await this.userCustomerRepository.findOne({
      where: { tc_vkn: data.tc_vkn },
    });
    if (existingByTc) {
      throw new AppError(400, 'Bu T.C. Kimlik No ile kayıtlı bir hesap zaten var');
    }

    // Email kontrolü
    const existingByEmail = await this.userCustomerRepository.findOne({
      where: { email: data.email },
    });
    if (existingByEmail) {
      throw new AppError(400, 'Bu e-posta adresi ile kayıtlı bir hesap zaten var');
    }

    // Telefon numarası kontrolü - formatla ve kontrol et
    let formattedPhone = data.phone.replace(/\s+/g, ''); // Boşlukları kaldır
    if (formattedPhone.startsWith('+90')) {
      formattedPhone = formattedPhone.substring(3);
    }
    if (formattedPhone.startsWith('0')) {
      formattedPhone = formattedPhone.substring(1);
    }
    formattedPhone = formattedPhone.replace(/\D/g, ''); // Sadece rakamlar
    
    const existingByPhone = await this.userCustomerRepository.findOne({
      where: { phone: formattedPhone },
    });
    if (existingByPhone) {
      throw new AppError(400, 'Bu telefon numarası zaten kullanılıyor. Lütfen farklı bir telefon numarası deneyin.');
    }

    // Şifreyi hashle
    const hashedPassword = await hashPassword(data.password);

    // Kullanıcı oluştur
    const userCustomer = this.userCustomerRepository.create({
      tc_vkn: data.tc_vkn,
      name: data.name,
      surname: data.surname,
      email: data.email,
      phone: formattedPhone, // Formatlanmış telefon numarasını kullan
      password: hashedPassword,
      city: data.city,
      district: data.district,
      address: data.address,
      is_active: true,
    });

    await this.userCustomerRepository.save(userCustomer);

    // JWT token oluştur
    const payload = {
      userId: userCustomer.id,
      email: userCustomer.email,
      role: 'USER_CUSTOMER', // Özel rol
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Şifre hariç kullanıcı bilgilerini döndür
    const { password, ...userWithoutPassword } = userCustomer;
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Kullanıcı girişi
   */
  async login(email: string, password: string) {
    // Email ile kullanıcı bul
    const userCustomer = await this.userCustomerRepository.findOne({
      where: { email },
    });

    if (!userCustomer) {
      throw new AppError(401, 'E-posta veya şifre hatalı');
    }

    // Hesap aktif mi kontrol et
    if (!userCustomer.is_active) {
      throw new AppError(403, 'Hesabınız aktif değil');
    }

    // Şifre kontrolü
    const isPasswordValid = await comparePassword(password, userCustomer.password);
    if (!isPasswordValid) {
      throw new AppError(401, 'E-posta veya şifre hatalı');
    }

    // JWT token oluştur
    const payload = {
      userId: userCustomer.id,
      email: userCustomer.email,
      role: 'USER_CUSTOMER', // Özel rol
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Şifre hariç kullanıcı bilgilerini döndür
    const { password: _, ...userWithoutPassword } = userCustomer;
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Token yenileme
   */
  async refreshToken(refreshToken: string) {
    try {
      const decoded = verifyToken(refreshToken);

      const userCustomer = await this.userCustomerRepository.findOne({
        where: { id: decoded.userId },
      });

      if (!userCustomer || !userCustomer.is_active) {
        throw new AppError(401, 'Geçersiz token');
      }

      const payload = {
        userId: userCustomer.id,
        email: userCustomer.email,
        role: 'USER_CUSTOMER',
      };

      const newAccessToken = generateAccessToken(payload);
      const newRefreshToken = generateRefreshToken(payload);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new AppError(401, 'Geçersiz token');
    }
  }

  /**
   * Profil bilgilerini getir
   */
  async getProfile(userId: string) {
    const userCustomer = await this.userCustomerRepository.findOne({
      where: { id: userId },
    });

    if (!userCustomer) {
      throw new AppError(404, 'Kullanıcı bulunamadı');
    }

    const { password, ...userWithoutPassword } = userCustomer;
    return userWithoutPassword;
  }

  /**
   * Profil güncelle
   */
  async updateProfile(userId: string, data: {
    name?: string;
    surname?: string;
    phone?: string;
    city?: string;
    district?: string;
    address?: string;
  }) {
    const userCustomer = await this.userCustomerRepository.findOne({
      where: { id: userId },
    });

    if (!userCustomer) {
      throw new AppError(404, 'Kullanıcı bulunamadı');
    }

    // Güncelleme yap
    if (data.name) userCustomer.name = data.name;
    if (data.surname) userCustomer.surname = data.surname;
    if (data.phone) userCustomer.phone = data.phone;
    if (data.city !== undefined) userCustomer.city = data.city;
    if (data.district !== undefined) userCustomer.district = data.district;
    if (data.address !== undefined) userCustomer.address = data.address;

    await this.userCustomerRepository.save(userCustomer);

    const { password, ...userWithoutPassword } = userCustomer;
    return userWithoutPassword;
  }

  /**
   * Şifre değiştir
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const userCustomer = await this.userCustomerRepository.findOne({
      where: { id: userId },
    });

    if (!userCustomer) {
      throw new AppError(404, 'Kullanıcı bulunamadı');
    }

    // Eski şifre kontrolü
    const isPasswordValid = await comparePassword(oldPassword, userCustomer.password);
    if (!isPasswordValid) {
      throw new AppError(401, 'Mevcut şifre yanlış');
    }

    // Yeni şifreyi hashle ve kaydet
    userCustomer.password = await hashPassword(newPassword);
    await this.userCustomerRepository.save(userCustomer);

    // SMS gönderme işlemi (hata durumunda ana işlemi etkilememeli)
    if (userCustomer.phone) {
      try {
        const { SmsService } = await import('./SmsService');
        const smsService = new SmsService();
        const smsMessage = `Merhaba ${userCustomer.name}${userCustomer.surname ? ' ' + userCustomer.surname : ''}, şifreniz başarıyla değiştirildi. Yeni şifreniz: ${newPassword}. 7/24 Destek: 0850 304 54 40`;
        console.log('📱 SMS gönderiliyor (UserCustomer şifre değiştirme):', userCustomer.phone);
        await smsService.sendSingleSms(userCustomer.phone, smsMessage);
        console.log('✅ SMS başarıyla gönderildi (UserCustomer şifre değiştirme)');
      } catch (error: any) {
        // SMS gönderme hatası ana işlemi etkilememeli, sadece log yaz
        console.error('❌ SMS gönderme hatası (UserCustomer şifre değiştirme):', error.message);
      }
    }

    return { message: 'Şifre başarıyla değiştirildi' };
  }

  /**
   * Şifre sıfırlama işlemi (phone ile)
   * Telefon numarası ile kullanıcı bulunur, yeni geçici şifre oluşturulur ve SMS ile gönderilir
   */
  async forgotPassword(phone: string) {
    console.log('🔍 UserCustomer forgotPassword çağrıldı');
    console.log(`🔍 Gelen telefon numarası: "${phone}"`);
    
    // Telefon numarasını temizle ve formatla
    let formattedPhone = phone.replace(/\s+/g, ''); // Boşlukları kaldır
    
    // +90 ile başlıyorsa kaldır
    if (formattedPhone.startsWith('+90')) {
      formattedPhone = formattedPhone.substring(3);
    }
    
    // 0 ile başlıyorsa kaldır
    if (formattedPhone.startsWith('0')) {
      formattedPhone = formattedPhone.substring(1);
    }
    
    // Sadece rakamlar kalmalı
    formattedPhone = formattedPhone.replace(/\D/g, '');
    
    console.log(`🔍 Formatlanmış telefon numarası: "${formattedPhone}"`);

    // Veritabanında hem formatlanmış hem de formatlanmamış numarayı ara
    let userCustomer = await this.userCustomerRepository.findOne({
      where: { phone: formattedPhone },
    });
    
    // Eğer bulunamadıysa, orijinal telefon numarası ile de dene
    if (!userCustomer && phone !== formattedPhone) {
      console.log(`🔍 Formatlanmış numara ile bulunamadı, orijinal numara ile deneniyor: "${phone}"`);
      userCustomer = await this.userCustomerRepository.findOne({
        where: { phone: phone },
      });
    }

    if (!userCustomer) {
      console.log(`❌ Kullanıcı bulunamadı - telefon: "${formattedPhone}" veya "${phone}"`);
      // Güvenlik nedeniyle kullanıcı bulunamadığında da başarılı mesajı döndür
      return { message: 'Eğer bu telefon numarasına kayıtlı bir hesap varsa, şifre sıfırlama bilgileri gönderildi.' };
    }

    console.log(`✅ Kullanıcı bulundu: ${userCustomer.name} ${userCustomer.surname || ''} - Telefon: "${userCustomer.phone}"`);

    if (!userCustomer.is_active) {
      console.log(`❌ Hesap aktif değil: ${userCustomer.id}`);
      throw new AppError(403, 'Hesap aktif değil');
    }

    // 8 karakterlik geçici şifre oluştur (büyük harf, küçük harf, rakam)
    const tempPassword = this.generateTempPassword(8);
    console.log(`🔑 Geçici şifre oluşturuldu: ${tempPassword}`);
    const hashedPassword = await hashPassword(tempPassword);

    // Şifreyi güncelle
    userCustomer.password = hashedPassword;
    await this.userCustomerRepository.save(userCustomer);
    console.log(`✅ Şifre güncellendi`);

    // SMS gönderme işlemi (hata durumunda ana işlemi etkilememeli)
    console.log(`📱 SMS gönderme kontrolü - userCustomer.phone: "${userCustomer.phone}"`);
    if (userCustomer.phone) {
      try {
        console.log('📱 SmsService import ediliyor...');
        const { SmsService } = await import('./SmsService');
        const smsService = new SmsService();
        const smsMessage = `Merhaba ${userCustomer.name}${userCustomer.surname ? ' ' + userCustomer.surname : ''}, şifre sıfırlama talebiniz alındı. Yeni geçici şifreniz: ${tempPassword}. Lütfen giriş yaptıktan sonra şifrenizi değiştirin. 7/24 Destek: 0850 304 54 40`;
        console.log('📱 SMS gönderiliyor (UserCustomer şifre sıfırlama)');
        console.log(`📱 Telefon: "${userCustomer.phone}"`);
        console.log(`📱 Mesaj: "${smsMessage.substring(0, 100)}..."`);
        await smsService.sendSingleSms(userCustomer.phone, smsMessage);
        console.log('✅ SMS başarıyla gönderildi (UserCustomer şifre sıfırlama)');
      } catch (error: any) {
        // SMS gönderme hatası ana işlemi etkilememeli, sadece log yaz
        console.error('❌ SMS gönderme hatası (UserCustomer şifre sıfırlama):', error.message);
        console.error('❌ SMS gönderme hatası (stack):', error.stack);
      }
    } else {
      console.log('⚠️ userCustomer.phone boş, SMS gönderilemedi');
    }

    return { message: 'Şifre sıfırlama bilgileri gönderildi.' };
  }

  /**
   * Geçici şifre oluştur
   * @param length - Şifre uzunluğu
   * @returns Rastgele şifre
   */
  private generateTempPassword(length: number): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const allChars = uppercase + lowercase + numbers;

    let password = '';
    // En az bir büyük harf, bir küçük harf ve bir rakam içermeli
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];

    // Kalan karakterleri rastgele ekle
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Karakterleri karıştır
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Satın alınan paketleri getir
   */
  async getMyPurchases(userId: string) {
    const sales = await this.saleRepository.find({
      where: { user_customer_id: userId },
      relations: ['package', 'vehicle', 'payments'],
      order: { created_at: 'DESC' },
    });

    return sales.map(sale => ({
      id: sale.id,
      package_name: sale.package?.name,
      package_type: sale.package?.vehicle_type,
      vehicle_plate: sale.vehicle?.plate,
      vehicle_type: sale.vehicle?.vehicle_type,
      price: sale.price,
      start_date: sale.start_date,
      end_date: sale.end_date,
      policy_number: sale.policy_number,
      is_refunded: sale.is_refunded,
      created_at: sale.created_at,
    }));
  }

  /**
   * Kullanıcının araçlarını getir
   */
  async getMyVehicles(userId: string) {
    const vehicles = await this.vehicleRepository.find({
      where: { user_customer_id: userId },
      relations: ['brand', 'model', 'motorBrand', 'motorModel'],
      order: { created_at: 'DESC' },
    });

    return vehicles;
  }

  /**
   * Paket satın alma işlemi başlatma
   * PayTR asenkron çalışır, bu metod sadece token döndürür
   * Ödeme işlemi callback'te yapılacak
   */
  async purchase(userId: string, input: {
    package_id: string;
    vehicle: {
      plate: string;
      brand_id?: number;
      model_id?: number;
      motor_brand_id?: number;
      motor_model_id?: number;
      model_year: number;
      usage_type: string;
      vehicle_type: string;
      is_foreign_plate?: boolean;
    };
    terms_accepted: boolean;
    // PayTR için URL'ler
    merchantOkUrl?: string;
    merchantFailUrl?: string;
    // Kullanıcı IP (req'den alınacak)
    userIp?: string;
  }, req?: any) {
    // Sözleşme onayı kontrolü
    if (!input.terms_accepted) {
      throw new AppError(400, 'Mesafeli satış sözleşmesini onaylamanız gerekmektedir');
    }

    // Kullanıcıyı al
    const userCustomer = await this.userCustomerRepository.findOne({
      where: { id: userId },
    });

    if (!userCustomer) {
      throw new AppError(404, 'Kullanıcı bulunamadı');
    }

    // Paketi al
    const pkg = await this.packageRepository.findOne({
      where: { id: input.package_id, status: EntityStatus.ACTIVE },
    });

    if (!pkg) {
      throw new AppError(404, 'Paket bulunamadı veya aktif değil');
    }

    // Araç yaşı kontrolü
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - input.vehicle.model_year;
    if (vehicleAge > pkg.max_vehicle_age) {
      throw new AppError(400, `Bu paket için araç yaşı maksimum ${pkg.max_vehicle_age} olmalıdır`);
    }

    // Araç türü kontrolü
    if (input.vehicle.vehicle_type !== pkg.vehicle_type) {
      throw new AppError(400, 'Seçilen paket bu araç türü için uygun değil');
    }

    // Transaction başlat
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Araç oluştur veya mevcut aracı kullan
      const isMotorcycle = input.vehicle.vehicle_type === 'Motosiklet';
      
      // Plaka normalize
      const normalizedPlate = input.vehicle.plate.toUpperCase().replace(/\s/g, '');
      
      // Aynı kullanıcının aynı plakası var mı kontrol et
      let vehicle = await queryRunner.manager.findOne(Vehicle, {
        where: { 
          user_customer_id: userId,
          plate: normalizedPlate,
        },
      });

      // usage_type string'i enum'a dönüştür
      const usageTypeMap: Record<string, UsageType> = {
        'PRIVATE': UsageType.PRIVATE,
        'COMMERCIAL': UsageType.COMMERCIAL,
        'TAXI': UsageType.TAXI,
      };
      const usageType = usageTypeMap[input.vehicle.usage_type] || UsageType.PRIVATE;

      if (!vehicle) {
        // Yeni araç oluştur
        vehicle = queryRunner.manager.create(Vehicle, {
          user_customer_id: userId,
          // UserCustomer için customer_id undefined (TypeORM undefined'ı ignore eder, null göndermez)
          // customer_id: undefined, // Açıkça belirtmeye gerek yok, entity'de nullable
          is_foreign_plate: input.vehicle.is_foreign_plate || false,
          plate: normalizedPlate,
          vehicle_type: input.vehicle.vehicle_type,
          brand_id: isMotorcycle ? null : input.vehicle.brand_id,
          model_id: isMotorcycle ? null : input.vehicle.model_id,
          motor_brand_id: isMotorcycle ? input.vehicle.motor_brand_id : null,
          motor_model_id: isMotorcycle ? input.vehicle.motor_model_id : null,
          model_year: input.vehicle.model_year,
          usage_type: usageType,
          agency_id: null,
          branch_id: null,
        });
        await queryRunner.manager.save(vehicle);
      }

      // 2. Satış kaydı oluştur
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // 1 yıl geçerli

      // Poliçe numarası oluştur
      const policyNumber = `UC${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const sale = queryRunner.manager.create(Sale, {
        user_customer_id: userId,
        // UserCustomer için customer_id null (undefined göndermiyoruz, TypeORM DEFAULT kullanıyor)
        // customer_id: null, // Açıkça null göndermeye gerek yok, entity'de nullable
        vehicle_id: vehicle.id,
        package_id: pkg.id,
        price: pkg.price,
        commission: 0, // Bireysel satışta komisyon yok
        // agency_commission ve branch_commission null olacak (undefined göndermiyoruz)
        start_date: startDate,
        end_date: endDate,
        policy_number: policyNumber,
        // agency_id, branch_id, user_id null olacak (undefined göndermiyoruz)
      });
      await queryRunner.manager.save(sale);

      // 3. PayTR token alma (iFrame için)
      // Kullanıcı IP adresini al
      const userIp = input.userIp || (req ? this.paytrService.getUserIp(req) : '127.0.0.1');

      // Ödeme tutarını kuruş cinsine çevir (100 ile çarp)
      const paymentAmount = Math.round(Number(pkg.price) * 100);

      // Sepet içeriği oluştur
      const basketItems = [
        {
          name: pkg.name,
          price: Number(pkg.price),
          quantity: 1,
        },
      ];
      const userBasket = this.paytrService.createBasket(basketItems);

      // merchant_ok_url ve merchant_fail_url'e sale_id'yi query parameter olarak ekle
      const baseOkUrl = input.merchantOkUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success`;
      const baseFailUrl = input.merchantFailUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/fail`;
      const merchantOkUrl = `${baseOkUrl}${baseOkUrl.includes('?') ? '&' : '?'}sale_id=${sale.id}`;
      const merchantFailUrl = `${baseFailUrl}${baseFailUrl.includes('?') ? '&' : '?'}sale_id=${sale.id}`;

      // PayTR token al
      const tokenResult = await this.paytrService.getToken({
        merchantOid: sale.id,
        email: userCustomer.email,
        paymentAmount: paymentAmount,
        currency: 'TL',
        userBasket: userBasket,
        userIp: userIp,
        userName: `${userCustomer.name} ${userCustomer.surname}`,
        userAddress: userCustomer.address || userCustomer.city || '',
        userPhone: userCustomer.phone || '',
        merchantOkUrl: merchantOkUrl,
        merchantFailUrl: merchantFailUrl,
        noInstallment: 0,
        maxInstallment: 0,
        timeoutLimit: 30,
        lang: 'tr',
        testMode: process.env.NODE_ENV === 'development' ? 1 : 0,
        debugOn: process.env.NODE_ENV === 'development' ? 1 : 0,
      });

      if (tokenResult.status !== 'success' || !tokenResult.token) {
        throw new AppError(400, tokenResult.reason || 'PayTR token alınamadı');
      }

      // 4. Pending durumda payment kaydı oluştur (callback'te güncellenecek)
      // UserCustomer için agency_id null
      const payment = queryRunner.manager.create(Payment, {
        sale_id: sale.id,
        // agency_id null - UserCustomer satışlarında acente yok
        amount: pkg.price,
        type: PaymentType.PAYTR,
        status: PaymentStatus.PENDING, // Callback'te COMPLETED veya FAILED olacak
        transaction_id: `PAYTR_PENDING_${sale.id}_${Date.now()}`,
        payment_details: {
          paytr_token: tokenResult.token,
          payment_initiated_at: new Date().toISOString(),
        },
      });
      await queryRunner.manager.save(payment);

      // Transaction'ı onayla
      await queryRunner.commitTransaction();

      return {
        success: true,
        sale_id: sale.id,
        token: tokenResult.token,
        iframe_url: `https://www.paytr.com/odeme/guvenli/${tokenResult.token}`,
        policy_number: policyNumber,
        package_name: pkg.name,
        customer_name: `${userCustomer.name} ${userCustomer.surname}`,
        vehicle_plate: normalizedPlate,
        start_date: startDate,
        end_date: endDate,
        price: pkg.price,
      };
    } catch (error) {
      // Hata durumunda transaction'ı geri al
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}


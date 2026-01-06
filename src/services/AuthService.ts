import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Agency } from '../entities/Agency';
import { UserAgency } from '../entities/UserAgency';
import { In } from 'typeorm';
import { hashPassword, comparePassword } from '../utils/hash';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { AppError } from '../middlewares/errorHandler';
import { EntityStatus, UserRole } from '../types/enums';
import { SmsService } from './SmsService';

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private agencyRepository = AppDataSource.getRepository(Agency);
  private userAgencyRepository = AppDataSource.getRepository(UserAgency);

  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['agency', 'branch'],
    });

    if (!user) {
      throw new AppError(401, 'E-posta veya şifre hatalı');
    }

    if (user.status !== EntityStatus.ACTIVE) {
      throw new AppError(403, 'Hesabınız aktif değil');
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(401, 'E-posta veya şifre hatalı');
    }

    // Plain text şifreyi güncelle - her login'de güncel şifre girildiği için plain_password'ü güncelle
    // Bu sayede SUPER_ADMIN her zaman güncel plain text şifreyi görebilir
    user.plain_password = password;
    await this.userRepository.save(user);

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // SUPER_AGENCY_ADMIN için yönettiği brokerları getir
    let managedAgencies = undefined;
    if (user.role === UserRole.SUPER_AGENCY_ADMIN) {
      try {
        // Junction table'dan brokerları getir
        let userAgencies = await this.userAgencyRepository.find({
          where: { user_id: user.id },
          relations: ['agency'],
        });
        
        // Eğer user_agencies tablosunda kayıt yoksa ama agency_id varsa, otomatik ekle
        if (userAgencies.length === 0 && user.agency_id) {
          // Önce agency'nin var olup olmadığını kontrol et
          const agency = await this.agencyRepository.findOne({
            where: { id: user.agency_id },
          });
          
          if (agency) {
            // user_agencies tablosuna ekle
            const userAgency = this.userAgencyRepository.create({
              user_id: user.id,
              agency_id: user.agency_id,
            });
            await this.userAgencyRepository.save(userAgency);
            
            // Tekrar getir
            userAgencies = await this.userAgencyRepository.find({
              where: { user_id: user.id },
              relations: ['agency'],
            });
            
            console.log(`✅ User ${user.id} için agency ${user.agency_id} otomatik olarak user_agencies tablosuna eklendi`);
          }
        }
        
        // Sadece gerekli alanları döndür
        managedAgencies = userAgencies.map(ua => ({
          id: ua.agency.id,
          name: ua.agency.name,
          tax_number: ua.agency.tax_number,
          address: ua.agency.address,
          phone: ua.agency.phone,
          email: ua.agency.email,
          commission_rate: ua.agency.commission_rate,
          balance: ua.agency.balance,
          status: ua.agency.status,
          logo: ua.agency.logo,
          account_name: ua.agency.account_name,
          iban: ua.agency.iban,
          created_at: ua.agency.created_at,
          updated_at: ua.agency.updated_at,
        }));
      } catch (error) {
        console.error('Yönetilen brokerlar getirilirken hata:', error);
        // Hata durumunda managedAgencies undefined kalır
      }
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        agency_id: user.agency_id,
        branch_id: user.branch_id,
        permissions: user.permissions,
        is_active: user.status === EntityStatus.ACTIVE,
      },
      accessToken,
      refreshToken,
      ...(managedAgencies && { managed_agencies: managedAgencies }),
    };
  }

  async register(userData: Partial<User>) {
    const existingUser = await this.userRepository.findOne({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new AppError(400, 'Bu e-posta adresi zaten kullanılıyor');
    }

    if (!userData.password) {
      throw new AppError(400, 'Şifre zorunludur');
    }

    const hashedPassword = await hashPassword(userData.password);
    // Plain text şifreyi sakla (SADECE SUPER_ADMIN için gösterilecek)
    const plainPassword = userData.password;

    const user = this.userRepository.create({
      ...userData,
      password: hashedPassword,
      plain_password: plainPassword, // Plain text şifreyi sakla
      status: EntityStatus.ACTIVE,
    });

    await this.userRepository.save(user);

    // Güvenlik: plain_password ve password'ü response'dan çıkar
    const { password, plain_password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      is_active: user.status === EntityStatus.ACTIVE,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = verifyToken(refreshToken);

      const user = await this.userRepository.findOne({
        where: { id: decoded.userId },
      });

      if (!user || user.status !== EntityStatus.ACTIVE) {
        throw new AppError(401, 'Geçersiz token');
      }

      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
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

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'Kullanıcı bulunamadı');
    }

    const isPasswordValid = await comparePassword(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new AppError(401, 'Mevcut şifre yanlış');
    }

    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    // Plain text şifreyi de güncelle (SADECE SUPER_ADMIN için gösterilecek)
    user.plain_password = newPassword;

    await this.userRepository.save(user);

    // SMS gönderme işlemi (hata durumunda ana işlemi etkilememeli)
    if (user.phone) {
      try {
        const smsService = new SmsService();
        const smsMessage = `Merhaba ${user.name}${user.surname ? ' ' + user.surname : ''}, şifreniz başarıyla değiştirildi. Yeni şifreniz: ${newPassword}. 7/24 Destek: 0850 304 54 40`;
        console.log('📱 SMS gönderiliyor (şifre değiştirme):', user.phone);
        await smsService.sendSingleSms(user.phone, smsMessage);
        console.log('✅ SMS başarıyla gönderildi (şifre değiştirme)');
      } catch (error: any) {
        // SMS gönderme hatası ana işlemi etkilememeli, sadece log yaz
        console.error('❌ SMS gönderme hatası (şifre değiştirme):', error.message);
      }
    }

    return { message: 'Password changed successfully' };
  }

  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['agency', 'branch'],
    });

    if (!user) {
      throw new AppError(404, 'Kullanıcı bulunamadı');
    }

    const { password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      is_active: user.status === EntityStatus.ACTIVE,
    };
  }

  /**
   * Şifre sıfırlama işlemi
   * Telefon numarası ile kullanıcı bulunur, yeni geçici şifre oluşturulur ve SMS ile gönderilir
   */
  async forgotPassword(phone: string) {
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

    const user = await this.userRepository.findOne({
      where: { phone: formattedPhone },
    });

    if (!user) {
      // Güvenlik nedeniyle kullanıcı bulunamadığında da başarılı mesajı döndür
      return { message: 'Eğer bu telefon numarasına kayıtlı bir hesap varsa, şifre sıfırlama bilgileri gönderildi.' };
    }

    if (user.status !== EntityStatus.ACTIVE) {
      throw new AppError(403, 'Hesap aktif değil');
    }

    // 8 karakterlik geçici şifre oluştur (büyük harf, küçük harf, rakam)
    const tempPassword = this.generateTempPassword(8);
    const hashedPassword = await hashPassword(tempPassword);

    // Şifreyi güncelle (hem hash'lenmiş hem de plain text)
    user.password = hashedPassword;
    user.plain_password = tempPassword; // Plain text şifreyi de güncelle (SADECE SUPER_ADMIN için gösterilecek)
    await this.userRepository.save(user);

    // SMS gönderme işlemi (hata durumunda ana işlemi etkilememeli)
    if (user.phone) {
      try {
        const smsService = new SmsService();
        const smsMessage = `Merhaba ${user.name}${user.surname ? ' ' + user.surname : ''}, şifre sıfırlama talebiniz alındı. Yeni geçici şifreniz: ${tempPassword}. Lütfen giriş yaptıktan sonra şifrenizi değiştirin. 7/24 Destek: 0850 304 54 40`;
        await smsService.sendSingleSms(user.phone, smsMessage);
      } catch (error: any) {
        // SMS gönderme hatası ana işlemi etkilememeli, sadece log yaz
        console.error('SMS gönderme hatası (şifre sıfırlama):', error.message);
      }
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
}

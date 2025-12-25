import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { hashPassword, comparePassword } from '../utils/hash';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { AppError } from '../middlewares/errorHandler';
import { EntityStatus } from '../types/enums';
import { SmsService } from './SmsService';

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);

  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['agency', 'branch'],
    });

    if (!user) {
      throw new AppError(401, 'Invalid credentials');
    }

    if (user.status !== EntityStatus.ACTIVE) {
      throw new AppError(403, 'Account is not active');
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(401, 'Invalid credentials');
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

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
    };
  }

  async register(userData: Partial<User>) {
    const existingUser = await this.userRepository.findOne({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new AppError(400, 'Email already exists');
    }

    if (!userData.password) {
      throw new AppError(400, 'Password is required');
    }

    const hashedPassword = await hashPassword(userData.password);

    const user = this.userRepository.create({
      ...userData,
      password: hashedPassword,
      status: EntityStatus.ACTIVE,
    });

    await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = user;
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
        throw new AppError(401, 'Invalid refresh token');
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
      throw new AppError(401, 'Invalid refresh token');
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const isPasswordValid = await comparePassword(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new AppError(401, 'Current password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;

    await this.userRepository.save(user);

    return { message: 'Password changed successfully' };
  }

  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['agency', 'branch'],
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      is_active: user.status === EntityStatus.ACTIVE,
    };
  }

  /**
   * Şifre sıfırlama işlemi
   * E-posta ile kullanıcı bulunur, yeni geçici şifre oluşturulur ve SMS ile gönderilir
   */
  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      // Güvenlik nedeniyle kullanıcı bulunamadığında da başarılı mesajı döndür
      return { message: 'Eğer bu e-posta adresine kayıtlı bir hesap varsa, şifre sıfırlama bilgileri gönderildi.' };
    }

    if (user.status !== EntityStatus.ACTIVE) {
      throw new AppError(403, 'Hesap aktif değil');
    }

    // 8 karakterlik geçici şifre oluştur (büyük harf, küçük harf, rakam)
    const tempPassword = this.generateTempPassword(8);
    const hashedPassword = await hashPassword(tempPassword);

    // Şifreyi güncelle
    user.password = hashedPassword;
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

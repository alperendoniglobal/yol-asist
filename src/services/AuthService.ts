import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { hashPassword, comparePassword } from '../utils/hash';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { AppError } from '../middlewares/errorHandler';
import { EntityStatus } from '../types/enums';

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
}

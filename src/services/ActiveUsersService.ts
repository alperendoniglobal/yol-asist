import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { UserRole } from '../types/enums';
import { UserAgency } from '../entities/UserAgency';
import { getSocketServer } from '../socket/socketServer';
import logger from '../utils/logger';

/**
 * Aktif kullanıcı bilgisi interface'i (API response için)
 */
export interface ActiveUserResponse {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
  agency?: {
    id: string;
    name: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  lastSeen: Date;
}

/**
 * Active Users Service
 * Socket server'dan aktif kullanıcıları getirir
 * REST API endpoint'leri için kullanılır
 */
export class ActiveUsersService {
  private userRepository = AppDataSource.getRepository(User);
  private userAgencyRepository = AppDataSource.getRepository(UserAgency);

  /**
   * Aktif kullanıcıları getir
   * SUPER_ADMIN: Tüm aktif kullanıcılar
   * SUPER_AGENCY_ADMIN: Yönettiği broker'lardaki aktif kullanıcılar
   */
  async getActiveUsers(currentUser: User): Promise<ActiveUserResponse[]> {
    // Socket server'dan aktif kullanıcıları al
    const socketServer = getSocketServer();
    if (!socketServer) {
      logger.warn('Socket server not initialized');
      return [];
    }

    const activeUsersMap = socketServer.getActiveUsers();
    let activeUsersList = Array.from(activeUsersMap.values());

    // Rol bazlı filtreleme
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      // SUPER_ADMIN: Tüm aktif kullanıcılar
      // Filtreleme yok, tüm aktif kullanıcılar
    } else if (currentUser.role === UserRole.SUPER_AGENCY_ADMIN) {
      // SUPER_AGENCY_ADMIN: Sadece yönettiği broker'lardaki aktif kullanıcılar
      // Yönettiği broker ID'lerini al
      const userAgencies = await this.userAgencyRepository.find({
        where: { user_id: currentUser.id },
      });

      const managedAgencyIds = userAgencies.map((ua) => ua.agency_id);

      if (managedAgencyIds.length === 0) {
        // Hiç broker yönetmiyorsa boş liste döndür
        return [];
      }

      // Sadece yönettiği broker'lardaki kullanıcıları filtrele
      activeUsersList = activeUsersList.filter((userInfo) => {
        return (
          userInfo.user.agency_id &&
          managedAgencyIds.includes(userInfo.user.agency_id)
        );
      });
    } else {
      // Diğer roller aktif kullanıcıları göremez
      logger.warn(
        `User ${currentUser.email} (${currentUser.role}) attempted to get active users`
      );
      return [];
    }

    // Kendi kullanıcısını listeden çıkar
    const filteredUsersList = activeUsersList.filter((userInfo) => userInfo.userId !== currentUser.id);

    // Kullanıcı bilgilerini formatla
    const formattedUsers: ActiveUserResponse[] = filteredUsersList.map(
      (userInfo) => {
        // Veritabanından güncel kullanıcı bilgilerini al (relations ile)
        // Socket'teki user objesi relations içermeyebilir, bu yüzden formatla
        return {
          id: userInfo.user.id,
          name: userInfo.user.name,
          surname: userInfo.user.surname || '',
          email: userInfo.user.email,
          role: userInfo.user.role,
          agency: userInfo.user.agency
            ? {
                id: userInfo.user.agency.id,
                name: userInfo.user.agency.name,
              }
            : undefined,
          branch: userInfo.user.branch
            ? {
                id: userInfo.user.branch.id,
                name: userInfo.user.branch.name,
              }
            : undefined,
          lastSeen: userInfo.connectedAt,
        };
      }
    );

    // Kullanıcıları email'e göre sırala
    formattedUsers.sort((a, b) => a.email.localeCompare(b.email));

    return formattedUsers;
  }

  /**
   * Aktif kullanıcı sayısını getir
   */
  async getActiveUsersCount(currentUser: User): Promise<number> {
    const activeUsers = await this.getActiveUsers(currentUser);
    return activeUsers.length;
  }

  /**
   * Belirli bir kullanıcının aktif olup olmadığını kontrol et
   */
  async isUserActive(userId: string): Promise<boolean> {
    const socketServer = getSocketServer();
    if (!socketServer) {
      return false;
    }

    return socketServer.isUserActive(userId);
  }
}

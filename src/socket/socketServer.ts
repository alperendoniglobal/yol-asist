import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { socketAuthMiddleware, AuthenticatedSocket } from './socketAuth';
import { User } from '../entities/User';
import { UserRole } from '../types/enums';
import logger from '../utils/logger';

/**
 * Aktif kullanıcı bilgisi interface'i
 */
export interface ActiveUserInfo {
  userId: string;
  socketId: string;
  user: User;
  connectedAt: Date;
}

/**
 * Socket Server Manager
 * Aktif kullanıcıları yönetir ve socket event'lerini handle eder
 */
export class SocketServer {
  private io: SocketIOServer;
  // Aktif kullanıcıları tutmak için Map: userId -> ActiveUserInfo
  private activeUsers: Map<string, ActiveUserInfo> = new Map();
  // Socket ID'den user ID'ye mapping: socketId -> userId
  private socketToUser: Map<string, string> = new Map();

  constructor(httpServer: HTTPServer) {
    // Socket.io server oluştur
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*', // Production'da daha spesifik olmalı
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Socket authentication middleware
    this.io.use((socket: Socket, next: (err?: Error) => void) => {
      socketAuthMiddleware(socket as AuthenticatedSocket, next);
    });

    // Connection event handler
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });

    logger.info('Socket.io server initialized');
  }

  /**
   * Kullanıcı bağlantısını handle eder
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    if (!socket.user || !socket.userId) {
      logger.warn('Socket connection without authenticated user');
      socket.disconnect();
      return;
    }

    const user = socket.user;
    const userId = user.id;
    const socketId = socket.id;

    // Eğer kullanıcı zaten bağlıysa, eski bağlantıyı kapat
    const existingConnection = this.activeUsers.get(userId);
    if (existingConnection) {
      logger.info(`Closing existing connection for user ${user.email} (${userId})`);
      this.io.to(existingConnection.socketId).emit('force-disconnect', {
        reason: 'New connection from same user',
      });
      this.io.sockets.sockets.get(existingConnection.socketId)?.disconnect();
      this.activeUsers.delete(userId);
      this.socketToUser.delete(existingConnection.socketId);
    }

    // Yeni bağlantıyı kaydet
    this.activeUsers.set(userId, {
      userId,
      socketId,
      user,
      connectedAt: new Date(),
    });
    this.socketToUser.set(socketId, userId);

    logger.info(`User connected: ${user.email} (${userId}) - Socket: ${socketId}`);

    // Kullanıcıya başarılı bağlantı mesajı gönder
    socket.emit('connected', {
      message: 'Socket connection established',
      userId: user.id,
    });

    // SUPER_ADMIN ve SUPER_AGENCY_ADMIN'e yeni kullanıcı online olduğunu bildir
    this.broadcastUserOnline(user, socket);

    // Socket event handler'ları
    this.setupSocketHandlers(socket);

    // Disconnect event handler
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Kullanıcı bağlantısı kesildiğinde handle eder
   */
  private handleDisconnection(socket: AuthenticatedSocket): void {
    const socketId = socket.id;
    const userId = this.socketToUser.get(socketId);

    if (userId) {
      const userInfo = this.activeUsers.get(userId);
      if (userInfo) {
        logger.info(`User disconnected: ${userInfo.user.email} (${userId}) - Socket: ${socketId}`);
        
        // Aktif kullanıcılardan kaldır
        this.activeUsers.delete(userId);
        this.socketToUser.delete(socketId);

        // SUPER_ADMIN ve SUPER_AGENCY_ADMIN'e kullanıcı offline olduğunu bildir
        this.broadcastUserOffline(userInfo.user);
      }
    }
  }

  /**
   * Kullanıcı online olduğunda SUPER_ADMIN ve SUPER_AGENCY_ADMIN'e bildir
   */
  private broadcastUserOnline(user: User, socket: AuthenticatedSocket): void {
    // SUPER_ADMIN ve SUPER_AGENCY_ADMIN'e bildir
    this.io.sockets.sockets.forEach((adminSocket: Socket) => {
      const adminUser = (adminSocket as AuthenticatedSocket).user;
      if (
        adminUser &&
        (adminUser.role === UserRole.SUPER_ADMIN ||
          adminUser.role === UserRole.SUPER_AGENCY_ADMIN)
      ) {
        // SUPER_AGENCY_ADMIN için: Sadece yönettiği broker'lardaki kullanıcıları göster
        if (adminUser.role === UserRole.SUPER_AGENCY_ADMIN) {
          // Yönettiği broker ID'lerini kontrol et
          const managedAgencyIds = adminUser.managedAgencies?.map(
            (ua) => ua.agency_id
          ) || [];
          
          // Kullanıcının agency_id'si yönettiği broker'lardan biri mi?
          if (user.agency_id && managedAgencyIds.includes(user.agency_id)) {
            adminSocket.emit('user:online', {
              userId: user.id,
              user: this.formatUserInfo(user),
            });
          }
        } else {
          // SUPER_ADMIN için: Tüm kullanıcıları göster
          adminSocket.emit('user:online', {
            userId: user.id,
            user: this.formatUserInfo(user),
          });
        }
      }
    });
  }

  /**
   * Kullanıcı offline olduğunda SUPER_ADMIN ve SUPER_AGENCY_ADMIN'e bildir
   */
  private broadcastUserOffline(user: User): void {
    // SUPER_ADMIN ve SUPER_AGENCY_ADMIN'e bildir
    this.io.sockets.sockets.forEach((adminSocket: Socket) => {
      const adminUser = (adminSocket as AuthenticatedSocket).user;
      if (
        adminUser &&
        (adminUser.role === UserRole.SUPER_ADMIN ||
          adminUser.role === UserRole.SUPER_AGENCY_ADMIN)
      ) {
        // SUPER_AGENCY_ADMIN için: Sadece yönettiği broker'lardaki kullanıcıları göster
        if (adminUser.role === UserRole.SUPER_AGENCY_ADMIN) {
          const managedAgencyIds = adminUser.managedAgencies?.map(
            (ua) => ua.agency_id
          ) || [];
          
          if (user.agency_id && managedAgencyIds.includes(user.agency_id)) {
            adminSocket.emit('user:offline', {
              userId: user.id,
            });
          }
        } else {
          // SUPER_ADMIN için: Tüm kullanıcıları göster
          adminSocket.emit('user:offline', {
            userId: user.id,
          });
        }
      }
    });
  }

  /**
   * Socket event handler'larını setup eder
   */
  private setupSocketHandlers(socket: AuthenticatedSocket): void {
    // Aktif kullanıcıları iste
    socket.on('get:active-users', () => {
      this.handleGetActiveUsers(socket);
    });
  }

  /**
   * Aktif kullanıcıları getir ve gönder
   */
  private handleGetActiveUsers(socket: AuthenticatedSocket): void {
    if (!socket.user) {
      return;
    }

    const user = socket.user;

    // Sadece SUPER_ADMIN ve SUPER_AGENCY_ADMIN aktif kullanıcıları görebilir
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.SUPER_AGENCY_ADMIN
    ) {
      socket.emit('error', {
        message: 'Unauthorized: Only SUPER_ADMIN and SUPER_AGENCY_ADMIN can view active users',
      });
      return;
    }

    let activeUsersList: ActiveUserInfo[] = [];

    if (user.role === UserRole.SUPER_ADMIN) {
      // SUPER_ADMIN: Tüm aktif kullanıcılar
      activeUsersList = Array.from(this.activeUsers.values());
    } else if (user.role === UserRole.SUPER_AGENCY_ADMIN) {
      // SUPER_AGENCY_ADMIN: Sadece yönettiği broker'lardaki aktif kullanıcılar
      const managedAgencyIds = user.managedAgencies?.map((ua) => ua.agency_id) || [];
      
      activeUsersList = Array.from(this.activeUsers.values()).filter((userInfo) => {
        return userInfo.user.agency_id && managedAgencyIds.includes(userInfo.user.agency_id);
      });
    }

    // Kendi kullanıcısını listeden çıkar
    const filteredUsersList = activeUsersList.filter((userInfo) => userInfo.userId !== user.id);

    // Kullanıcı bilgilerini formatla
    const formattedUsers = filteredUsersList.map((userInfo) => ({
      id: userInfo.user.id,
      name: userInfo.user.name,
      surname: userInfo.user.surname,
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
    }));

    socket.emit('active-users', formattedUsers);
  }

  /**
   * Kullanıcı bilgisini formatla (public bilgiler)
   */
  private formatUserInfo(user: User): any {
    return {
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      role: user.role,
      agency: user.agency
        ? {
            id: user.agency.id,
            name: user.agency.name,
          }
        : undefined,
      branch: user.branch
        ? {
            id: user.branch.id,
            name: user.branch.name,
          }
        : undefined,
    };
  }

  /**
   * Aktif kullanıcı sayısını döndürür
   */
  public getActiveUsersCount(): number {
    return this.activeUsers.size;
  }

  /**
   * Belirli bir kullanıcının aktif olup olmadığını kontrol eder
   */
  public isUserActive(userId: string): boolean {
    return this.activeUsers.has(userId);
  }

  /**
   * Tüm aktif kullanıcıları döndürür (internal use)
   */
  public getActiveUsers(): Map<string, ActiveUserInfo> {
    return this.activeUsers;
  }

  /**
   * Socket.io server instance'ını döndürür
   */
  public getIO(): SocketIOServer {
    return this.io;
  }
}

// Singleton instance
let socketServerInstance: SocketServer | null = null;

/**
 * Socket server instance'ını oluşturur veya mevcut olanı döndürür
 */
export const initializeSocketServer = (httpServer: HTTPServer): SocketServer => {
  if (!socketServerInstance) {
    socketServerInstance = new SocketServer(httpServer);
  }
  return socketServerInstance;
};

/**
 * Socket server instance'ını döndürür
 */
export const getSocketServer = (): SocketServer | null => {
  return socketServerInstance;
};

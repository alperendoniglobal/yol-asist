import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Agency } from '../entities/Agency';
import { Sale } from '../entities/Sale';
import { Customer } from '../entities/Customer';
import { UserAgency } from '../entities/UserAgency';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { In } from 'typeorm';
import { hashPassword } from '../utils/hash';
import { EntityStatus, UserRole } from '../types/enums';
import { SmsService } from './SmsService';

export class UserService {
  private userRepository = AppDataSource.getRepository(User);
  private agencyRepository = AppDataSource.getRepository(Agency);
  private saleRepository = AppDataSource.getRepository(Sale);
  private customerRepository = AppDataSource.getRepository(Customer);
  private userAgencyRepository = AppDataSource.getRepository(UserAgency);

  // Tum kullanicilari getir (silinen kullanicilar haric)
  // Şube yöneticisi sadece kendi şubesindeki kullanıcıları görebilir (acente yöneticisini göremez)
  // Acente yöneticisi acenteki tüm kullanıcıları görebilir
  // SUPER_ADMIN tüm kullanıcıları görebilir (aktif ve pasif - status filtresi yok)
  async getAll(filter?: any, currentUser?: User) {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.agency', 'agency')
      .leftJoinAndSelect('user.branch', 'branch')
      .where('user.is_deleted = :isDeleted', { isDeleted: false }) // Soft delete filtresi
      .select([
        'user.id',
        'user.name',
        'user.surname',
        'user.email',
        'user.phone',
        'user.role',
        'user.status',
        'user.agency_id',
        'user.branch_id',
        'user.created_at',
        'agency.id',
        'agency.name',
        'branch.id',
        'branch.name',
      ]);

    if (filter) {
      applyTenantFilter(queryBuilder, filter, 'user');
    }

    // Şube yöneticisi için özel filtreleme:
    // - Sadece kendi şubesindeki kullanıcıları görebilir
    // - Acente yöneticisini (AGENCY_ADMIN) göremez
    // - Sadece kendi şubesindeki BRANCH_USER ve BRANCH_ADMIN'leri görebilir
    if (currentUser && currentUser.role === UserRole.BRANCH_ADMIN && currentUser.branch_id) {
      // Şube yöneticisi sadece kendi şubesindeki kullanıcıları görebilir
      queryBuilder.andWhere('user.branch_id = :branchId', { branchId: currentUser.branch_id });
      // Acente yöneticisini görmemeli (AGENCY_ADMIN rolünü filtrele)
      queryBuilder.andWhere('user.role != :agencyAdminRole', { agencyAdminRole: UserRole.AGENCY_ADMIN });
    }

    // ÖNEMLİ: Status filtresi YOK - tüm kullanıcılar (aktif ve pasif) getirilir
    // SUPER_ADMIN tüm kullanıcıları görebilir (aktif ve pasif dahil)
    // AGENCY_ADMIN acenteki tüm kullanıcıları görebilir (aktif ve pasif dahil)
    // BRANCH_ADMIN şubesindeki tüm kullanıcıları görebilir (aktif ve pasif dahil)
    // Status filtresi eklenmemeli - tüm roller aktif ve pasif kullanıcıları görebilir

    const users = await queryBuilder.getMany();
    return users.map(user => ({
      ...user,
      is_active: user.status === EntityStatus.ACTIVE,
    }));
  }

  // Kullanici detaylarini getir
  async getById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id, is_deleted: false },
      relations: ['agency', 'branch'],
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        agency_id: true,
        branch_id: true,
        permissions: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'Kullanici bulunamadi');
    }

    return {
      ...user,
      is_active: user.status === EntityStatus.ACTIVE,
    };
  }

  // Kullanici detaylari ile birlikte aktivitelerini getir
  // Bu metod acente yoneticisinin calisanlarinin islemlerini gormesi icin
  // SUPER_ADMIN için plain_password bilgisi de döndürülür (GÜVENLİK KRİTİK: SADECE SUPER_ADMIN)
  async getByIdWithActivity(id: string, currentUser?: User) {
    const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
    
    // SUPER_ADMIN ise plain_password'ü de seç (select: false olduğu için manuel seçmemiz gerekiyor)
    const user = await this.userRepository.findOne({
      where: { id, is_deleted: false },
      relations: ['agency', 'branch'],
      select: isSuperAdmin 
        ? ['id', 'name', 'surname', 'email', 'phone', 'password', 'plain_password', 'role', 'status', 'agency_id', 'branch_id', 'permissions', 'created_at', 'updated_at']
        : undefined, // Diğerleri için tüm alanlar (plain_password hariç - select: false)
    });

    if (!user) {
      throw new AppError(404, 'Kullanici bulunamadi');
    }

    // Kullanicinin satis sayisi ve toplam geliri
    const salesStats = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.user_id = :userId', { userId: id })
      .select([
        'COUNT(sale.id) as total_sales',
        'SUM(sale.price) as total_revenue',
        'SUM(sale.commission) as total_commission',
      ])
      .getRawOne();

    // Son satislar (son 10)
    const recentSales = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.package', 'package')
      .where('sale.user_id = :userId', { userId: id })
      .orderBy('sale.created_at', 'DESC')
      .limit(10)
      .getMany();

    // Kullanicinin ekledigi musteri sayisi
    const customerCount = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.created_by = :userId', { userId: id })
      .getCount();

    // Kullanicinin sattigi arac sayisi (satislardan)
    // Vehicle tablosunda created_by yok, satis uzerinden hesapliyoruz
    const vehicleCount = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.user_id = :userId', { userId: id })
      .select('COUNT(DISTINCT sale.vehicle_id)', 'count')
      .getRawOne();

    // Aylik satis trendi (son 6 ay)
    const monthlySales = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.user_id = :userId', { userId: id })
      .andWhere('sale.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)')
      .select([
        "DATE_FORMAT(sale.created_at, '%Y-%m') as month",
        'COUNT(sale.id) as count',
        'SUM(sale.price) as revenue',
      ])
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // GÜVENLİK KRİTİK: plain_password SADECE SUPER_ADMIN için döndürülür
    if (isSuperAdmin) {
      // SUPER_ADMIN için plain_password'ü de döndür
      return {
        ...user,
        password: user.password, // Hash'lenmiş şifre (opsiyonel, gösterilebilir)
        plain_password: (user as any).plain_password || null, // Plain text şifre (SADECE SUPER_ADMIN)
        is_active: user.status === EntityStatus.ACTIVE,
        activity: {
          total_sales: parseInt(salesStats?.total_sales || '0'),
          total_revenue: parseFloat(salesStats?.total_revenue || '0'),
          total_commission: parseFloat(salesStats?.total_commission || '0'),
          customer_count: customerCount,
          vehicle_count: parseInt(vehicleCount?.count || '0'),
          recent_sales: recentSales.map(sale => ({
            id: sale.id,
            customer_name: sale.customer?.name || 'Bilinmiyor',
            package_name: sale.package?.name || 'Bilinmiyor',
            price: sale.price,
            created_at: sale.created_at,
          })),
          monthly_sales: monthlySales.map((item: any) => ({
            month: item.month,
            count: parseInt(item.count) || 0,
            revenue: parseFloat(item.revenue) || 0,
          })),
        },
      };
    } else {
      // GÜVENLİK: Diğer kullanıcılar için password ve plain_password döndürülmez
      const { password, plain_password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      is_active: user.status === EntityStatus.ACTIVE,
      activity: {
        total_sales: parseInt(salesStats?.total_sales || '0'),
        total_revenue: parseFloat(salesStats?.total_revenue || '0'),
        total_commission: parseFloat(salesStats?.total_commission || '0'),
        customer_count: customerCount,
        vehicle_count: parseInt(vehicleCount?.count || '0'),
        recent_sales: recentSales.map(sale => ({
          id: sale.id,
          customer_name: sale.customer?.name || 'Bilinmiyor',
          package_name: sale.package?.name || 'Bilinmiyor',
          price: sale.price,
          created_at: sale.created_at,
        })),
        monthly_sales: monthlySales.map((item: any) => ({
          month: item.month,
          count: parseInt(item.count) || 0,
          revenue: parseFloat(item.revenue) || 0,
        })),
      },
    };
    }
  }

  // Yeni kullanici olustur
  // SUPPORT rolü sadece SUPER_ADMIN tarafından oluşturulabilir
  async create(data: Partial<User>, currentUser?: User) {
    // SUPPORT rolü kontrolü: Sadece SUPER_ADMIN SUPPORT rolü oluşturabilir
    if (data.role === UserRole.SUPPORT) {
      if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
        throw new AppError(403, 'SUPPORT rolü sadece SUPER_ADMIN tarafından oluşturulabilir');
      }
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(400, 'Bu e-posta adresi zaten kullaniliyor');
    }

    if (!data.password) {
      throw new AppError(400, 'Sifre zorunludur');
    }

    const hashedPassword = await hashPassword(data.password);
    // Plain text şifreyi sakla (SADECE SUPER_ADMIN için gösterilecek)
    const plainPassword = data.password;

    // Foreign key'ler icin bos string'leri null'a cevir
    if (data.branch_id === '') {
      data.branch_id = null as any;
    }
    if (data.agency_id === '') {
      data.agency_id = null as any;
    }

    const user = this.userRepository.create({
      ...data,
      password: hashedPassword,
      plain_password: plainPassword, // Plain text şifreyi sakla
      is_deleted: false,
    });

    await this.userRepository.save(user);

    // SUPER_AGENCY_ADMIN rolünde kullanıcı oluşturulduğunda, seçilen agency_id'yi user_agencies tablosuna ekle
    if (user.role === UserRole.SUPER_AGENCY_ADMIN && user.agency_id) {
      try {
        // Önce agency'nin var olup olmadığını kontrol et
        const agency = await this.agencyRepository.findOne({
          where: { id: user.agency_id },
        });

        if (agency) {
          // user_agencies tablosuna ekle
          const existingAssignment = await this.userAgencyRepository.findOne({
            where: { user_id: user.id, agency_id: user.agency_id },
          });

          if (!existingAssignment) {
            const userAgency = this.userAgencyRepository.create({
              user_id: user.id,
              agency_id: user.agency_id,
            });
            await this.userAgencyRepository.save(userAgency);
            console.log(`✅ SUPER_AGENCY_ADMIN user ${user.id} için agency ${user.agency_id} user_agencies tablosuna eklendi`);
          } else {
            console.log(`⚠️ SUPER_AGENCY_ADMIN user ${user.id} için agency ${user.agency_id} zaten user_agencies tablosunda mevcut`);
          }
        } else {
          console.log(`⚠️ SUPER_AGENCY_ADMIN user ${user.id} için agency ${user.agency_id} bulunamadı`);
        }
      } catch (error: any) {
        // user_agencies ekleme hatası ana işlemi etkilememeli, sadece log yaz
        console.error('❌ user_agencies ekleme hatası:', error.message);
        console.error('❌ user_agencies ekleme hatası (stack):', error.stack);
      }
    }

    // SMS gönderme işlemi (hata durumunda ana işlemi etkilememeli)
    if (user.phone) {
      try {
        const smsService = new SmsService();
        const smsMessage = `Merhaba ${user.name}${user.surname ? ' ' + user.surname : ''}, hesabınıza hoş geldiniz. E-posta: ${user.email}, Şifre: ${data.password}. Giriş Yapmak İçin: https://cozum.net/login 7/24 Destek: 0850 304 54 40`;
        console.log('📱 SMS gönderiliyor (yeni kullanıcı):', user.phone);
        console.log('📱 Kullanıcı bilgileri:', { name: user.name, surname: user.surname, email: user.email });
        await smsService.sendSingleSms(user.phone, smsMessage);
        console.log('✅ SMS başarıyla gönderildi (yeni kullanıcı)');
      } catch (error: any) {
        // SMS gönderme hatası ana işlemi etkilememeli, sadece log yaz
        console.error('❌ SMS gönderme hatası (yeni kullanıcı):', error.message);
        console.error('❌ SMS gönderme hatası (stack):', error.stack);
      }
    } else {
      console.log('⚠️ SMS gönderilemedi (yeni kullanıcı): Telefon numarası bulunamadı');
    }

    // Güvenlik: plain_password ve password'ü response'dan çıkar
    const { password, plain_password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      is_active: user.status === EntityStatus.ACTIVE,
    };
  }

  // Kullanici guncelle
  // SUPPORT rolü sadece SUPER_ADMIN tarafından atanabilir
  async update(id: string, data: Partial<User>, currentUser?: User) {
    const user = await this.userRepository.findOne({ 
      where: { id, is_deleted: false } 
    });

    if (!user) {
      throw new AppError(404, 'Kullanici bulunamadi');
    }

    // SUPPORT rolü kontrolü: Sadece SUPER_ADMIN SUPPORT rolü atayabilir
    // Eğer kullanıcı zaten SUPPORT ise ve başka bir role değiştirilmeye çalışılıyorsa, yine SUPER_ADMIN olmalı
    if (data.role === UserRole.SUPPORT || user.role === UserRole.SUPPORT) {
      if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
        throw new AppError(403, 'SUPPORT rolü sadece SUPER_ADMIN tarafından atanabilir veya değiştirilebilir');
      }
    }

    if (data.email && data.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: data.email },
      });
      if (existingUser) {
        throw new AppError(400, 'Bu e-posta adresi zaten kullaniliyor');
      }
    }

    // Şifre değişikliği kontrolü (hash'lenmeden önce sakla)
    const newPassword = data.password;
    const passwordChanged = !!data.password; // Şifre gönderilmişse değişiklik var

    if (data.password) {
      data.password = await hashPassword(data.password);
      // Plain text şifreyi de sakla (SADECE SUPER_ADMIN için gösterilecek)
      (data as any).plain_password = newPassword;
    }

    // Foreign key'ler icin bos string'leri null'a cevir
    if (data.branch_id === '') {
      data.branch_id = null as any;
    }
    if (data.agency_id === '') {
      data.agency_id = null as any;
    }

    Object.assign(user, data);
    await this.userRepository.save(user);

    // SUPER_AGENCY_ADMIN rolü güncellendiğinde veya agency_id değiştirildiğinde, user_agencies tablosuna ekle
    // Eğer kullanıcının rolü SUPER_AGENCY_ADMIN ise ve agency_id varsa, user_agencies tablosuna ekle
    if (user.role === UserRole.SUPER_AGENCY_ADMIN && user.agency_id) {
      try {
        // Önce agency'nin var olup olmadığını kontrol et
        const agency = await this.agencyRepository.findOne({
          where: { id: user.agency_id },
        });

        if (agency) {
          // user_agencies tablosuna ekle (varsa ekleme)
          const existingAssignment = await this.userAgencyRepository.findOne({
            where: { user_id: user.id, agency_id: user.agency_id },
          });

          if (!existingAssignment) {
            const userAgency = this.userAgencyRepository.create({
              user_id: user.id,
              agency_id: user.agency_id,
            });
            await this.userAgencyRepository.save(userAgency);
            console.log(`✅ SUPER_AGENCY_ADMIN user ${user.id} için agency ${user.agency_id} user_agencies tablosuna eklendi (güncelleme)`);
          } else {
            console.log(`⚠️ SUPER_AGENCY_ADMIN user ${user.id} için agency ${user.agency_id} zaten user_agencies tablosunda mevcut (güncelleme)`);
          }
        } else {
          console.log(`⚠️ SUPER_AGENCY_ADMIN user ${user.id} için agency ${user.agency_id} bulunamadı (güncelleme)`);
        }
      } catch (error: any) {
        // user_agencies ekleme hatası ana işlemi etkilememeli, sadece log yaz
        console.error('❌ user_agencies ekleme hatası (güncelleme):', error.message);
        console.error('❌ user_agencies ekleme hatası (stack):', error.stack);
      }
    }

    // Şifre değiştirildiyse SMS gönder
    if (passwordChanged && newPassword && user.phone) {
      try {
        const smsService = new SmsService();
        const smsMessage = `Merhaba ${user.name}${user.surname ? ' ' + user.surname : ''}, şifreniz yönetici tarafından değiştirildi. Yeni şifreniz: ${newPassword}. 7/24 Destek: 0850 304 54 40`;
        console.log('📱 SMS gönderiliyor (yönetici şifre değiştirme):', user.phone);
        await smsService.sendSingleSms(user.phone, smsMessage);
        console.log('✅ SMS başarıyla gönderildi (yönetici şifre değiştirme)');
      } catch (error: any) {
        // SMS gönderme hatası ana işlemi etkilememeli, sadece log yaz
        console.error('❌ SMS gönderme hatası (yönetici şifre değiştirme):', error.message);
      }
    }

    // Güvenlik: plain_password ve password'ü response'dan çıkar
    const { password, plain_password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      is_active: user.status === EntityStatus.ACTIVE,
    };
  }

  // Soft delete - kullaniciyi sil olarak isaretle (hard delete degil)
  // Gecmis veriler korunur, sadece is_deleted true olur
  async delete(id: string) {
    const user = await this.userRepository.findOne({ 
      where: { id, is_deleted: false } 
    });

    if (!user) {
      throw new AppError(404, 'Kullanici bulunamadi');
    }

    // Soft delete: is_deleted = true, deleted_at = now
    user.is_deleted = true;
    user.deleted_at = new Date();
    user.status = EntityStatus.INACTIVE; // Pasif yap

    await this.userRepository.save(user);
    return { message: 'Kullanici basariyla silindi' };
  }

  // Kullanici durumunu degistir (aktif/pasif)
  // Acente yoneticisi calisanlarini aktif/pasif yapabilir
  async toggleStatus(id: string) {
    const user = await this.userRepository.findOne({ 
      where: { id, is_deleted: false } 
    });

    if (!user) {
      throw new AppError(404, 'Kullanici bulunamadi');
    }

    // Durumu tersine cevir
    user.status = user.status === EntityStatus.ACTIVE 
      ? EntityStatus.INACTIVE 
      : EntityStatus.ACTIVE;

    await this.userRepository.save(user);

    // GÜVENLİK: plain_password ve password'ü response'dan çıkar
    const { password, plain_password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      is_active: user.status === EntityStatus.ACTIVE,
    };
  }

  // Izinleri guncelle
  async updatePermissions(id: string, permissions: any) {
    const user = await this.userRepository.findOne({ 
      where: { id, is_deleted: false } 
    });

    if (!user) {
      throw new AppError(404, 'Kullanici bulunamadi');
    }

    user.permissions = permissions;
    await this.userRepository.save(user);

    // GÜVENLİK: plain_password ve password'ü response'dan çıkar
    const { password, plain_password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      is_active: user.status === EntityStatus.ACTIVE,
    };
  }

  /**
   * SUPER_AGENCY_ADMIN kullanıcısına broker atama
   * @param userId - Kullanıcı ID'si
   * @param agencyId - Broker ID'si
   */
  async assignAgency(userId: string, agencyId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId, is_deleted: false },
    });

    if (!user) {
      throw new AppError(404, 'Kullanıcı bulunamadı');
    }

    // Sadece SUPER_AGENCY_ADMIN rolüne broker atanabilir
    if (user.role !== UserRole.SUPER_AGENCY_ADMIN) {
      throw new AppError(400, 'Sadece süper broker yöneticilerine broker atanabilir');
    }

    // Broker var mı kontrol et
    const agency = await this.agencyRepository.findOne({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new AppError(404, 'Broker bulunamadı');
    }

    // Zaten atanmış mı kontrol et
    const existingUserAgency = await this.userAgencyRepository.findOne({
      where: { user_id: userId, agency_id: agencyId },
    });

    if (existingUserAgency) {
      return {
        message: 'Broker zaten kullanıcıya atanmış',
        user: {
          ...user,
          is_active: user.status === EntityStatus.ACTIVE,
        },
      };
    }

    // Junction table'a kayıt ekle
    const userAgency = this.userAgencyRepository.create({
      user_id: userId,
      agency_id: agencyId,
    });
    await this.userAgencyRepository.save(userAgency);

    // GÜVENLİK: plain_password ve password'ü response'dan çıkar
    const { password, plain_password, ...userWithoutPassword } = user;
    return {
      message: 'Broker başarıyla atandı',
      user: {
        ...userWithoutPassword,
        is_active: user.status === EntityStatus.ACTIVE,
      },
    };
  }

  /**
   * SUPER_AGENCY_ADMIN kullanıcısından broker kaldırma
   * @param userId - Kullanıcı ID'si
   * @param agencyId - Broker ID'si
   */
  async removeAgency(userId: string, agencyId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId, is_deleted: false },
    });

    if (!user) {
      throw new AppError(404, 'Kullanıcı bulunamadı');
    }

    // Broker atanmış mı kontrol et
    const userAgency = await this.userAgencyRepository.findOne({
      where: { user_id: userId, agency_id: agencyId },
    });

    if (!userAgency) {
      throw new AppError(400, 'Bu broker kullanıcıya atanmamış');
    }

    // Junction table'dan kayıt sil
    await this.userAgencyRepository.remove(userAgency);

    // GÜVENLİK: plain_password ve password'ü response'dan çıkar
    const { password, plain_password, ...userWithoutPassword } = user;
    return {
      message: 'Broker başarıyla kaldırıldı',
      user: {
        ...userWithoutPassword,
        is_active: user.status === EntityStatus.ACTIVE,
      },
    };
  }

  /**
   * Kullanıcının yönettiği brokerları getir
   * @param userId - Kullanıcı ID'si
   */
  async getManagedAgencies(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId, is_deleted: false },
    });

    if (!user) {
      throw new AppError(404, 'Kullanıcı bulunamadı');
    }

    // Junction table'dan broker ID'lerini al
    const userAgencies = await this.userAgencyRepository.find({
      where: { user_id: userId },
      relations: ['agency'],
    });

    // Agency objelerini döndür
    return userAgencies.map(ua => ua.agency);
  }
}

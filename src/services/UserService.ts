import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Sale } from '../entities/Sale';
import { Customer } from '../entities/Customer';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { hashPassword } from '../utils/hash';
import { EntityStatus } from '../types/enums';

export class UserService {
  private userRepository = AppDataSource.getRepository(User);
  private saleRepository = AppDataSource.getRepository(Sale);
  private customerRepository = AppDataSource.getRepository(Customer);

  // Tum kullanicilari getir (silinen kullanicilar haric)
  async getAll(filter?: any) {
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
  async getByIdWithActivity(id: string) {
    const user = await this.userRepository.findOne({
      where: { id, is_deleted: false },
      relations: ['agency', 'branch'],
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

    const { password, ...userWithoutPassword } = user;

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

  // Yeni kullanici olustur
  async create(data: Partial<User>) {
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
      is_deleted: false,
    });

    await this.userRepository.save(user);

    const { password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      is_active: user.status === EntityStatus.ACTIVE,
    };
  }

  // Kullanici guncelle
  async update(id: string, data: Partial<User>) {
    const user = await this.userRepository.findOne({ 
      where: { id, is_deleted: false } 
    });

    if (!user) {
      throw new AppError(404, 'Kullanici bulunamadi');
    }

    if (data.email && data.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: data.email },
      });
      if (existingUser) {
        throw new AppError(400, 'Bu e-posta adresi zaten kullaniliyor');
      }
    }

    if (data.password) {
      data.password = await hashPassword(data.password);
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

    const { password, ...userWithoutPassword } = user;
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

    const { password, ...userWithoutPassword } = user;
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

    const { password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      is_active: user.status === EntityStatus.ACTIVE,
    };
  }
}

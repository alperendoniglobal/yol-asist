import { AppDataSource } from '../config/database';
import { DealerApplication } from '../entities/DealerApplication';
import { Agency } from '../entities/Agency';
import { User } from '../entities/User';
import { AppError } from '../middlewares/errorHandler';
import { DealerApplicationStatus, UserRole, EntityStatus } from '../types/enums';
import * as bcrypt from 'bcrypt';

/**
 * Bayilik Başvuru Servisi
 * Bayilik başvurularının yönetimi ve onay işlemleri
 */
export class DealerApplicationService {
  private applicationRepository = AppDataSource.getRepository(DealerApplication);
  private agencyRepository = AppDataSource.getRepository(Agency);
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Yeni bayilik başvurusu oluştur
   */
  async create(data: {
    name: string;
    surname: string;
    email: string;
    phone: string;
    tc_vkn: string;
    company_name?: string;
    city: string;
    district?: string;
    address?: string;
    referral_code?: string;
    password: string;
  }) {
    // Email zaten kullanılıyor mu kontrol et
    const existingApplication = await this.applicationRepository.findOne({
      where: { email: data.email },
    });

    if (existingApplication) {
      throw new AppError(400, 'Bu e-posta adresi ile daha önce başvuru yapılmış');
    }

    // Email mevcut kullanıcılarda var mı kontrol et
    const existingUser = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(400, 'Bu e-posta adresi zaten sistemde kayıtlı');
    }

    // Şifreyi hashle
    const password_hash = await bcrypt.hash(data.password, 10);

    // Başvuru oluştur
    const application = this.applicationRepository.create({
      name: data.name,
      surname: data.surname,
      email: data.email,
      phone: data.phone,
      tc_vkn: data.tc_vkn,
      company_name: data.company_name,
      city: data.city,
      district: data.district,
      address: data.address,
      referral_code: data.referral_code,
      password_hash,
      status: DealerApplicationStatus.PENDING,
    });

    await this.applicationRepository.save(application);

    return {
      id: application.id,
      name: application.name,
      surname: application.surname,
      email: application.email,
      status: application.status,
      created_at: application.created_at,
    };
  }

  /**
   * Tüm başvuruları getir (Super Admin için)
   */
  async getAll(filter?: { status?: DealerApplicationStatus }) {
    const queryBuilder = this.applicationRepository
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.reviewer', 'reviewer')
      .orderBy('application.created_at', 'DESC');

    if (filter?.status) {
      queryBuilder.where('application.status = :status', { status: filter.status });
    }

    const applications = await queryBuilder.getMany();

    return applications.map((app) => ({
      id: app.id,
      name: app.name,
      surname: app.surname,
      email: app.email,
      phone: app.phone,
      tc_vkn: app.tc_vkn,
      company_name: app.company_name,
      city: app.city,
      district: app.district,
      address: app.address,
      referral_code: app.referral_code,
      status: app.status,
      notes: app.notes,
      reviewed_at: app.reviewed_at,
      reviewer: app.reviewer
        ? { id: app.reviewer.id, name: app.reviewer.name, surname: app.reviewer.surname }
        : null,
      created_at: app.created_at,
      updated_at: app.updated_at,
    }));
  }

  /**
   * Tek bir başvuruyu getir
   */
  async getById(id: string) {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: ['reviewer'],
    });

    if (!application) {
      throw new AppError(404, 'Başvuru bulunamadı');
    }

    return {
      id: application.id,
      name: application.name,
      surname: application.surname,
      email: application.email,
      phone: application.phone,
      tc_vkn: application.tc_vkn,
      company_name: application.company_name,
      city: application.city,
      district: application.district,
      address: application.address,
      referral_code: application.referral_code,
      status: application.status,
      notes: application.notes,
      reviewed_at: application.reviewed_at,
      reviewer: application.reviewer
        ? { id: application.reviewer.id, name: application.reviewer.name, surname: application.reviewer.surname }
        : null,
      created_at: application.created_at,
      updated_at: application.updated_at,
    };
  }

  /**
   * Başvuruyu onayla ve acente oluştur
   */
  async approve(id: string, adminUserId: string, notes?: string) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const application = await queryRunner.manager.findOne(DealerApplication, {
        where: { id },
      });

      if (!application) {
        throw new AppError(404, 'Başvuru bulunamadı');
      }

      if (application.status !== DealerApplicationStatus.PENDING) {
        throw new AppError(400, 'Bu başvuru zaten işleme alınmış');
      }

      // 1. Acente oluştur
      const agencyName = application.company_name || `${application.name} ${application.surname}`;
      const agency = queryRunner.manager.create(Agency, {
        name: agencyName,
        tax_number: application.tc_vkn,
        phone: application.phone,
        email: application.email,
        address: application.address
          ? `${application.address}, ${application.district || ''}, ${application.city}`
          : application.city,
        commission_rate: 20, // Varsayılan komisyon oranı %20
        balance: 0,
        status: EntityStatus.ACTIVE,
      });
      await queryRunner.manager.save(agency);

      // 2. Acente admin kullanıcısı oluştur
      const user = queryRunner.manager.create(User, {
        agency_id: agency.id,
        name: application.name,
        surname: application.surname,
        email: application.email,
        phone: application.phone,
        password: application.password_hash, // Zaten hashlenmiş
        role: UserRole.AGENCY_ADMIN,
        is_active: true,
      });
      await queryRunner.manager.save(user);

      // 3. Başvuru durumunu güncelle
      application.status = DealerApplicationStatus.APPROVED;
      application.notes = notes || 'Başvuru onaylandı, acente oluşturuldu.';
      application.reviewed_at = new Date();
      application.reviewed_by = adminUserId;
      await queryRunner.manager.save(application);

      await queryRunner.commitTransaction();

      return {
        application: {
          id: application.id,
          status: application.status,
          notes: application.notes,
        },
        agency: {
          id: agency.id,
          name: agency.name,
        },
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          surname: user.surname,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Başvuruyu reddet
   */
  async reject(id: string, adminUserId: string, notes: string) {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new AppError(404, 'Başvuru bulunamadı');
    }

    if (application.status !== DealerApplicationStatus.PENDING) {
      throw new AppError(400, 'Bu başvuru zaten işleme alınmış');
    }

    if (!notes || notes.trim() === '') {
      throw new AppError(400, 'Red sebebi belirtilmelidir');
    }

    application.status = DealerApplicationStatus.REJECTED;
    application.notes = notes;
    application.reviewed_at = new Date();
    application.reviewed_by = adminUserId;

    await this.applicationRepository.save(application);

    return {
      id: application.id,
      status: application.status,
      notes: application.notes,
    };
  }

  /**
   * Bekleyen başvuru sayısını getir
   */
  async getPendingCount() {
    return this.applicationRepository.count({
      where: { status: DealerApplicationStatus.PENDING },
    });
  }
}


import { AppDataSource } from '../config/database';
import { SupportFile } from '../entities/SupportFile';
import { AppError } from '../middlewares/errorHandler';

/**
 * Destek Ekibi Hasar Dosyası Servisi
 * Hasar dosyalarını yönetir
 */
export class SupportFileService {
  private fileRepository = AppDataSource.getRepository(SupportFile);

  /**
   * Benzersiz hasar dosya numarası oluştur
   * Format: HS-YYYYMMDD-HHMMSS-RANDOM
   */
  private generateDamageFileNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `HS-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
  }

  /**
   * Tüm hasar dosyalarını getir
   * Kullanıcının rolüne göre filtreleme yapar:
   * - SUPER_ADMIN: Tüm dosyaları görebilir
   * - SUPPORT: Tüm dosyaları görebilir
   * - AGENCY_ADMIN: Kendi acentesinin satışlarına ait dosyaları görebilir
   * - BRANCH_ADMIN: Kendi şubesinin satışlarına ait dosyaları görebilir
   */
  async getAll(filter?: any, user?: any) {
    const queryBuilder = this.fileRepository
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.sale', 'sale')
      .leftJoinAndSelect('file.creator', 'creator')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.vehicle', 'vehicle')
      .leftJoinAndSelect('sale.package', 'package')
      .leftJoinAndSelect('sale.agency', 'agency')
      .leftJoinAndSelect('sale.branch', 'branch')
      .orderBy('file.created_at', 'DESC');

    // Rol bazlı filtreleme
    if (user) {
      const { UserRole } = await import('../types/enums');
      
      // SUPER_ADMIN ve SUPPORT tüm dosyaları görebilir
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.SUPPORT) {
        // AGENCY_ADMIN: Kendi acentesinin satışlarına ait dosyaları görebilir
        if (user.role === UserRole.AGENCY_ADMIN && user.agency_id) {
          queryBuilder.andWhere('sale.agency_id = :agency_id', { agency_id: user.agency_id });
        }
        // BRANCH_ADMIN: Kendi şubesinin satışlarına ait dosyaları görebilir
        else if (user.role === UserRole.BRANCH_ADMIN) {
          if (user.branch_id) {
            queryBuilder.andWhere('sale.branch_id = :branch_id', { branch_id: user.branch_id });
          } else if (user.agency_id) {
            // Şubesi yoksa tüm acente satışlarını görebilir
            queryBuilder.andWhere('sale.agency_id = :agency_id', { agency_id: user.agency_id });
          }
        }
      }
    }

    // Ek filtreleme
    if (filter) {
      if (filter.sale_id) {
        queryBuilder.andWhere('file.sale_id = :sale_id', { sale_id: filter.sale_id });
      }
      if (filter.created_by) {
        queryBuilder.andWhere('file.created_by = :created_by', { created_by: filter.created_by });
      }
    }

    return await queryBuilder.getMany();
  }

  /**
   * ID ile hasar dosyası getir
   */
  async getById(id: string) {
    const file = await this.fileRepository.findOne({
      where: { id },
      relations: ['sale', 'creator', 'sale.customer', 'sale.vehicle', 'sale.package'],
    });

    if (!file) {
      throw new AppError(404, 'Hasar dosyası bulunamadı');
    }

    return file;
  }

  /**
   * Satış ID'ye göre hasar dosyalarını getir
   */
  async getBySaleId(saleId: string) {
    return await this.fileRepository.find({
      where: { sale_id: saleId },
      relations: ['sale', 'creator'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Yeni hasar dosyası oluştur
   */
  async create(data: Partial<SupportFile>) {
    // Hasar dosya numarası otomatik oluştur
    let damageFileNumber = data.damage_file_number;
    if (!damageFileNumber) {
      damageFileNumber = this.generateDamageFileNumber();
      
      // Benzersizlik kontrolü (çok nadir olsa da)
      let exists = await this.fileRepository.findOne({
        where: { damage_file_number: damageFileNumber },
      });
      
      let attempts = 0;
      while (exists && attempts < 10) {
        damageFileNumber = this.generateDamageFileNumber();
        exists = await this.fileRepository.findOne({
          where: { damage_file_number: damageFileNumber },
        });
        attempts++;
      }
    }

    const file = this.fileRepository.create({
      ...data,
      damage_file_number: damageFileNumber,
    });

    return await this.fileRepository.save(file);
  }

  /**
   * Hasar dosyası güncelle
   */
  async update(id: string, data: Partial<SupportFile>) {
    const file = await this.fileRepository.findOne({ where: { id } });

    if (!file) {
      throw new AppError(404, 'Hasar dosyası bulunamadı');
    }

    // Hasar dosya numarası değiştirilemez
    const { damage_file_number, ...updateData } = data;
    
    Object.assign(file, updateData);
    return await this.fileRepository.save(file);
  }

  /**
   * Hasar dosyası sil
   */
  async delete(id: string) {
    const file = await this.fileRepository.findOne({ where: { id } });

    if (!file) {
      throw new AppError(404, 'Hasar dosyası bulunamadı');
    }

    await this.fileRepository.remove(file);
    return { message: 'Hasar dosyası başarıyla silindi' };
  }
}





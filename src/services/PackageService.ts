import { AppDataSource } from '../config/database';
import { Package } from '../entities/Package';
import { PackageCover } from '../entities/PackageCover';
import { AppError } from '../middlewares/errorHandler';

/**
 * Paket Servisi
 * Sigorta/Yol Asistan paketlerinin yönetimi
 * Artık sabit fiyatlı paketler kullanılıyor (model yılına göre değil)
 */
export class PackageService {
  private packageRepository = AppDataSource.getRepository(Package);
  private coverRepository = AppDataSource.getRepository(PackageCover);

  // ===== PAKET İŞLEMLERİ =====

  /**
   * Tüm paketleri getir
   * @param filter Filtreleme seçenekleri (vehicle_type, status)
   * Sıralama: Önce araç türüne göre, sonra fiyata göre artan
   */
  async getAll(filter?: any) {
    // Önce paketleri al (covers olmadan, düzgün sıralama için)
    const queryBuilder = this.packageRepository
      .createQueryBuilder('package')
      .orderBy('package.vehicle_type', 'ASC')
      .addOrderBy('package.price', 'ASC');

    // Araç türüne göre filtrele
    if (filter?.vehicle_type) {
      queryBuilder.where('package.vehicle_type = :vehicle_type', { 
        vehicle_type: filter.vehicle_type 
      });
    }

    // Duruma göre filtrele
    if (filter?.status) {
      queryBuilder.andWhere('package.status = :status', { status: filter.status });
    }

    const packages = await queryBuilder.getMany();
    
    // Her paket için covers'ları ayrı ayrı çek (sıralama bozulmasın)
    const packagesWithCovers = await Promise.all(
      packages.map(async (pkg) => {
        const covers = await this.coverRepository.find({
          where: { package_id: pkg.id },
          order: { sort_order: 'ASC' },
        });
        return { ...pkg, covers };
      })
    );

    return packagesWithCovers;
  }

  /**
   * ID ile paket getir
   * Covers sort_order'a göre sıralı gelir
   */
  async getById(id: string) {
    const pkg = await this.packageRepository.findOne({
      where: { id },
    });

    if (!pkg) {
      throw new AppError(404, 'Paket bulunamadı');
    }

    // Covers'ları sıralı getir
    const covers = await this.coverRepository.find({
      where: { package_id: id },
      order: { sort_order: 'ASC' },
    });

    return { ...pkg, covers };
  }

  /**
   * Yeni paket oluştur
   */
  async create(data: Partial<Package>) {
    const pkg = this.packageRepository.create(data);
    await this.packageRepository.save(pkg);
    return pkg;
  }

  /**
   * Paket güncelle
   */
  async update(id: string, data: Partial<Package>) {
    const pkg = await this.packageRepository.findOne({ where: { id } });

    if (!pkg) {
      throw new AppError(404, 'Paket bulunamadı');
    }

    Object.assign(pkg, data);
    await this.packageRepository.save(pkg);
    return pkg;
  }

  /**
   * Paket sil
   */
  async delete(id: string) {
    const pkg = await this.packageRepository.findOne({ where: { id } });

    if (!pkg) {
      throw new AppError(404, 'Paket bulunamadı');
    }

    await this.packageRepository.remove(pkg);
    return { message: 'Paket başarıyla silindi' };
  }

  // ===== KAPSAM İŞLEMLERİ =====

  /**
   * Paketin kapsamlarını getir
   */
  async getCovers(packageId: string) {
    const covers = await this.coverRepository.find({
      where: { package_id: packageId },
      order: { sort_order: 'ASC' },
    });
    return covers;
  }

  /**
   * Pakete kapsam ekle
   */
  async addCover(packageId: string, data: Partial<PackageCover>) {
    const pkg = await this.packageRepository.findOne({ where: { id: packageId } });

    if (!pkg) {
      throw new AppError(404, 'Paket bulunamadı');
    }

    // Mevcut kapsamların sayısını al (sort_order için)
    const existingCovers = await this.coverRepository.count({ 
      where: { package_id: packageId } 
    });

    const cover = this.coverRepository.create({
      ...data,
      package_id: packageId,
      sort_order: data.sort_order ?? existingCovers + 1,
    });

    await this.coverRepository.save(cover);
    return cover;
  }

  /**
   * Kapsamı güncelle
   */
  async updateCover(packageId: string, coverId: string, data: Partial<PackageCover>) {
    const cover = await this.coverRepository.findOne({
      where: { id: coverId, package_id: packageId },
    });

    if (!cover) {
      throw new AppError(404, 'Kapsam bulunamadı');
    }

    Object.assign(cover, data);
    await this.coverRepository.save(cover);
    return cover;
  }

  /**
   * Kapsamı sil
   */
  async deleteCover(packageId: string, coverId: string) {
    const cover = await this.coverRepository.findOne({
      where: { id: coverId, package_id: packageId },
    });

    if (!cover) {
      throw new AppError(404, 'Kapsam bulunamadı');
    }

    await this.coverRepository.remove(cover);
    return { message: 'Kapsam başarıyla silindi' };
  }

  // ===== YARDIMCI METODLAR =====

  /**
   * Araç türüne göre paketleri getir
   * Fiyata göre artan sıralı
   */
  async getByVehicleType(vehicleType: string) {
    const packages = await this.packageRepository.find({
      where: { vehicle_type: vehicleType },
      order: { price: 'ASC' },
    });

    // Her paket için covers'ları sıralı getir
    const packagesWithCovers = await Promise.all(
      packages.map(async (pkg) => {
        const covers = await this.coverRepository.find({
          where: { package_id: pkg.id },
          order: { sort_order: 'ASC' },
        });
        return { ...pkg, covers };
      })
    );

    return packagesWithCovers;
  }

  /**
   * Araç yaşına uygun paketleri getir (Satış sırasında kullanılır)
   * @param vehicleType Araç türü
   * @param vehicleAge Araç yaşı
   * Fiyata göre artan sıralı
   */
  async getAvailablePackages(vehicleType: string, vehicleAge: number) {
    // Önce uygun paketleri al
    const packages = await this.packageRepository
      .createQueryBuilder('package')
      .where('package.vehicle_type = :vehicleType', { vehicleType })
      .andWhere('package.max_vehicle_age >= :vehicleAge', { vehicleAge })
      .andWhere('package.status = :status', { status: 'ACTIVE' })
      .orderBy('package.price', 'ASC')
      .getMany();

    // Her paket için covers'ları sıralı getir
    const packagesWithCovers = await Promise.all(
      packages.map(async (pkg) => {
        const covers = await this.coverRepository.find({
          where: { package_id: pkg.id },
          order: { sort_order: 'ASC' },
        });
        return { ...pkg, covers };
      })
    );

    return packagesWithCovers;
  }
}

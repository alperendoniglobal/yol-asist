import { AppDataSource } from '../config/database';
import { CarBrand } from '../entities/CarBrand';
import { AppError } from '../middlewares/errorHandler';

/** Yeni marka oluştururken body */
export interface CreateCarBrandInput {
  name: string;
  id?: number; // Opsiyonel; verilmezse MAX(id)+1 kullanılır
}

/** Marka güncellerken body */
export interface UpdateCarBrandInput {
  name: string;
}

export class CarBrandService {
  private brandRepository = AppDataSource.getRepository(CarBrand);

  async getAll() {
    return await this.brandRepository.find({
      order: { name: 'ASC' },
      relations: ['models'],
    });
  }

  async getById(id: number) {
    const brand = await this.brandRepository.findOne({
      where: { id },
      relations: ['models'],
    });

    if (!brand) {
      throw new AppError(404, 'Car brand not found');
    }

    return brand;
  }

  /**
   * Yeni araç markası oluşturur. Sadece SUPER_ADMIN kullanabilir.
   * id verilmezse veritabanındaki MAX(id)+1 atanır.
   */
  async create(input: CreateCarBrandInput) {
    const name = (input.name || '').trim();
    if (!name) {
      throw new AppError(400, 'Marka adı zorunludur');
    }

    let id = input.id;
    if (id == null) {
      const result = await this.brandRepository
        .createQueryBuilder('b')
        .select('MAX(b.id)', 'maxId')
        .getRawOne<{ maxId: number | null }>();
      id = (result?.maxId ?? 0) + 1;
    }

    const existing = await this.brandRepository.findOne({ where: { id } });
    if (existing) {
      throw new AppError(409, `Bu ID zaten kullanılıyor (${id}). Farklı bir id gönderin veya id alanını boş bırakın.`);
    }

    const brand = this.brandRepository.create({ id, name });
    await this.brandRepository.save(brand);
    return brand;
  }

  /**
   * Araç markasını günceller. Sadece SUPER_ADMIN kullanabilir.
   */
  async update(id: number, input: UpdateCarBrandInput) {
    const brand = await this.brandRepository.findOne({ where: { id } });
    if (!brand) {
      throw new AppError(404, 'Car brand not found');
    }

    const name = (input.name || '').trim();
    if (!name) {
      throw new AppError(400, 'Marka adı zorunludur');
    }

    brand.name = name;
    await this.brandRepository.save(brand);
    return brand;
  }

  /**
   * Araç markasını siler. Sadece SUPER_ADMIN kullanabilir.
   * Bu markayı kullanan araç (vehicle) varsa silme yapılmaz.
   */
  async delete(id: number) {
    const brand = await this.brandRepository.findOne({ where: { id } });
    if (!brand) {
      throw new AppError(404, 'Car brand not found');
    }

    const { Vehicle } = await import('../entities/Vehicle');
    const vehicleRepo = AppDataSource.getRepository(Vehicle);
    const usedCount = await vehicleRepo.count({ where: { brand_id: id } });
    if (usedCount > 0) {
      throw new AppError(
        409,
        `Bu marka ${usedCount} araç kaydında kullanılıyor. Önce bu araçların markasını değiştirin veya kayıtları güncelleyin.`
      );
    }

    await this.brandRepository.remove(brand);
    return { deleted: true, id };
  }
}


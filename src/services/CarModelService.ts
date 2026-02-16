import { AppDataSource } from '../config/database';
import { CarModel } from '../entities/CarModel';
import { CarBrand } from '../entities/CarBrand';
import { AppError } from '../middlewares/errorHandler';

/** Yeni model oluştururken body */
export interface CreateCarModelInput {
  brand_id: number;
  name: string;
  value?: string | null;
  id?: number; // Opsiyonel; verilmezse MAX(id)+1 kullanılır
}

/** Model güncellerken body */
export interface UpdateCarModelInput {
  brand_id?: number;
  name?: string;
  value?: string | null;
}

export class CarModelService {
  private modelRepository = AppDataSource.getRepository(CarModel);
  private brandRepository = AppDataSource.getRepository(CarBrand);

  async getAll(brandId?: number) {
    const queryBuilder = this.modelRepository
      .createQueryBuilder('model')
      .leftJoinAndSelect('model.brand', 'brand')
      .orderBy('model.name', 'ASC');

    if (brandId) {
      queryBuilder.where('model.brand_id = :brandId', { brandId });
    }

    return await queryBuilder.getMany();
  }

  async getById(id: number) {
    const model = await this.modelRepository.findOne({
      where: { id },
      relations: ['brand'],
    });

    // Model bulunamazsa null döndür, hata fırlatma
    // Frontend'de model null ise boş bırakılacak
    return model;
  }

  async getByBrand(brandId: number) {
    return await this.modelRepository.find({
      where: { brand_id: brandId },
      order: { name: 'ASC' },
      relations: ['brand'],
    });
  }

  /**
   * Yeni araç modeli oluşturur. Sadece SUPER_ADMIN kullanabilir.
   * brand_id mevcut bir marka olmalıdır. id verilmezse MAX(id)+1 atanır.
   */
  async create(input: CreateCarModelInput) {
    const name = (input.name || '').trim();
    if (!name) {
      throw new AppError(400, 'Model adı zorunludur');
    }
    if (!input.brand_id) {
      throw new AppError(400, 'brand_id zorunludur');
    }

    const brand = await this.brandRepository.findOne({ where: { id: input.brand_id } });
    if (!brand) {
      throw new AppError(404, 'Belirtilen marka bulunamadı');
    }

    let id = input.id;
    if (id == null) {
      const result = await this.modelRepository
        .createQueryBuilder('m')
        .select('MAX(m.id)', 'maxId')
        .getRawOne<{ maxId: number | null }>();
      id = (result?.maxId ?? 0) + 1;
    }

    const existing = await this.modelRepository.findOne({ where: { id } });
    if (existing) {
      throw new AppError(409, `Bu ID zaten kullanılıyor (${id}). Farklı bir id gönderin veya id alanını boş bırakın.`);
    }

    const model = this.modelRepository.create({
      id,
      brand_id: input.brand_id,
      name,
      value: input.value != null ? input.value : undefined,
    });
    await this.modelRepository.save(model);
    return await this.modelRepository.findOne({
      where: { id: model.id },
      relations: ['brand'],
    }) as CarModel;
  }

  /**
   * Araç modelini günceller. Sadece SUPER_ADMIN kullanabilir.
   */
  async update(id: number, input: UpdateCarModelInput) {
    const model = await this.modelRepository.findOne({ where: { id }, relations: ['brand'] });
    if (!model) {
      throw new AppError(404, 'Car model not found');
    }

    if (input.name !== undefined) {
      const name = (input.name || '').trim();
      if (!name) {
        throw new AppError(400, 'Model adı boş olamaz');
      }
      model.name = name;
    }
    if (input.brand_id !== undefined) {
      const brand = await this.brandRepository.findOne({ where: { id: input.brand_id } });
      if (!brand) {
        throw new AppError(404, 'Belirtilen marka bulunamadı');
      }
      model.brand_id = input.brand_id;
      model.brand = brand;
    }
    if (input.value !== undefined) {
      model.value = input.value ?? null;
    }

    await this.modelRepository.save(model);
    return model;
  }

  /**
   * Araç modelini siler. Sadece SUPER_ADMIN kullanabilir.
   * Bu modeli kullanan araç (vehicle) varsa silme yapılmaz.
   */
  async delete(id: number) {
    const model = await this.modelRepository.findOne({ where: { id } });
    if (!model) {
      throw new AppError(404, 'Car model not found');
    }

    const { Vehicle } = await import('../entities/Vehicle');
    const vehicleRepo = AppDataSource.getRepository(Vehicle);
    const usedCount = await vehicleRepo.count({ where: { model_id: id } });
    if (usedCount > 0) {
      throw new AppError(
        409,
        `Bu model ${usedCount} araç kaydında kullanılıyor. Önce bu araçların modelini değiştirin veya kayıtları güncelleyin.`
      );
    }

    await this.modelRepository.remove(model);
    return { deleted: true, id };
  }
}


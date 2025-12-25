import { AppDataSource } from '../config/database';
import { MotorBrand } from '../entities/MotorBrand';
import { AppError } from '../middlewares/errorHandler';

/**
 * Motor Marka Servisi
 * Motosiklet markaları ile ilgili işlemleri yönetir
 */
export class MotorBrandService {
  private brandRepository = AppDataSource.getRepository(MotorBrand);

  /**
   * Tüm motor markalarını getirir
   * Modelleriyle birlikte döner
   */
  async getAll() {
    return await this.brandRepository.find({
      order: { name: 'ASC' },
      relations: ['models'],
    });
  }

  /**
   * ID'ye göre motor markasını getirir
   * Modelleriyle birlikte döner
   */
  async getById(id: number) {
    const brand = await this.brandRepository.findOne({
      where: { id },
      relations: ['models'],
    });

    if (!brand) {
      throw new AppError(404, 'Motor brand not found');
    }

    return brand;
  }
}


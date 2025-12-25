import { AppDataSource } from '../config/database';
import { MotorModel } from '../entities/MotorModel';
import { AppError } from '../middlewares/errorHandler';

/**
 * Motor Model Servisi
 * Motosiklet modelleri ile ilgili işlemleri yönetir
 */
export class MotorModelService {
  private modelRepository = AppDataSource.getRepository(MotorModel);

  /**
   * Tüm motor modellerini getirir
   */
  async getAll() {
    return await this.modelRepository.find({
      order: { name: 'ASC' },
      relations: ['brand'],
    });
  }

  /**
   * Marka ID'sine göre modelleri getirir
   */
  async getByBrandId(brandId: number) {
    return await this.modelRepository.find({
      where: { brand_id: brandId },
      order: { name: 'ASC' },
      relations: ['brand'],
    });
  }

  /**
   * ID'ye göre motor modelini getirir
   */
  async getById(id: number) {
    const model = await this.modelRepository.findOne({
      where: { id },
      relations: ['brand'],
    });

    if (!model) {
      throw new AppError(404, 'Motor model not found');
    }

    return model;
  }
}


import { AppDataSource } from '../config/database';
import { CarModel } from '../entities/CarModel';
import { AppError } from '../middlewares/errorHandler';

export class CarModelService {
  private modelRepository = AppDataSource.getRepository(CarModel);

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

    if (!model) {
      throw new AppError(404, 'Car model not found');
    }

    return model;
  }

  async getByBrand(brandId: number) {
    return await this.modelRepository.find({
      where: { brand_id: brandId },
      order: { name: 'ASC' },
      relations: ['brand'],
    });
  }
}


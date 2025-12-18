import { AppDataSource } from '../config/database';
import { CarBrand } from '../entities/CarBrand';
import { AppError } from '../middlewares/errorHandler';

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
}


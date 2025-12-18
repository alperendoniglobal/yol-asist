import { AppDataSource } from '../config/database';
import { Vehicle } from '../entities/Vehicle';
import { AppError } from '../middlewares/errorHandler';
import { applyAgencyFilter } from '../middlewares/tenantMiddleware';

export class VehicleService {
  private vehicleRepository = AppDataSource.getRepository(Vehicle);

  // Araçları listele (tenant filter ile)
  // Not: Vehicle entity'sinde created_by kolonu yok, sadece agency_id ve branch_id ile filtreliyoruz
  async getAll(filter?: any) {
    const queryBuilder = this.vehicleRepository
      .createQueryBuilder('vehicle')
      .leftJoinAndSelect('vehicle.customer', 'customer')
      .leftJoinAndSelect('vehicle.agency', 'agency')
      .leftJoinAndSelect('vehicle.branch', 'branch')
      .leftJoinAndSelect('vehicle.brand', 'brand')
      .leftJoinAndSelect('vehicle.model', 'model')
      .orderBy('vehicle.created_at', 'DESC');

    if (filter) {
      // Vehicle'da created_by yok, sadece agency_id filtresi uygula
      // branch_id varsa onu da ekle
      applyAgencyFilter(queryBuilder, filter, 'vehicle');
      if (filter.branch_id) {
        queryBuilder.andWhere('vehicle.branch_id = :branch_id', { branch_id: filter.branch_id });
      }
    }

    const vehicles = await queryBuilder.getMany();
    return vehicles;
  }

  // ID ile araç getir
  async getById(id: string) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
      relations: ['customer', 'agency', 'branch', 'brand', 'model'],
    });

    if (!vehicle) {
      throw new AppError(404, 'Vehicle not found');
    }

    return vehicle;
  }

  // Yeni araç oluştur
  async create(data: Partial<Vehicle>) {
    const existingVehicle = await this.vehicleRepository.findOne({
      where: { plate: data.plate },
    });

    if (existingVehicle) {
      throw new AppError(400, 'Vehicle with this plate already exists');
    }

    const vehicle = this.vehicleRepository.create(data);
    await this.vehicleRepository.save(vehicle);
    return vehicle;
  }

  // Araç güncelle
  async update(id: string, data: Partial<Vehicle>) {
    const vehicle = await this.vehicleRepository.findOne({ where: { id } });

    if (!vehicle) {
      throw new AppError(404, 'Vehicle not found');
    }

    if (data.plate && data.plate !== vehicle.plate) {
      const existingVehicle = await this.vehicleRepository.findOne({
        where: { plate: data.plate },
      });
      if (existingVehicle) {
        throw new AppError(400, 'Vehicle with this plate already exists');
      }
    }

    Object.assign(vehicle, data);
    await this.vehicleRepository.save(vehicle);
    return vehicle;
  }

  // Araç sil
  async delete(id: string) {
    const vehicle = await this.vehicleRepository.findOne({ where: { id } });

    if (!vehicle) {
      throw new AppError(404, 'Vehicle not found');
    }

    await this.vehicleRepository.remove(vehicle);
    return { message: 'Vehicle deleted successfully' };
  }

  // Müşteriye ait araçları getir
  async getByCustomer(customerId: string) {
    const vehicles = await this.vehicleRepository.find({
      where: { customer_id: customerId },
      relations: ['customer'],
    });
    return vehicles;
  }

  // Plakaya göre araç bul
  async findByPlate(plate: string) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { plate: plate.toUpperCase() },
      relations: ['customer', 'agency', 'branch', 'brand', 'model'],
    });
    return vehicle;
  }

  // Araç bul veya oluştur (satış akışı için)
  // Plaka varsa mevcut aracı döndür, yoksa yeni oluştur
  async findOrCreate(data: Partial<Vehicle>) {
    // Plakayı büyük harfe çevir
    const plate = data.plate?.toUpperCase();
    
    // Mevcut araç var mı kontrol et
    const existingVehicle = await this.vehicleRepository.findOne({
      where: { plate },
      relations: ['customer', 'agency', 'branch', 'brand', 'model'],
    });

    if (existingVehicle) {
      // Mevcut aracı döndür
      return { vehicle: existingVehicle, isNew: false };
    }

    // Yeni araç oluştur
    const vehicle = this.vehicleRepository.create({ ...data, plate });
    await this.vehicleRepository.save(vehicle);
    
    // İlişkilerle birlikte tekrar çek
    const savedVehicle = await this.vehicleRepository.findOne({
      where: { id: vehicle.id },
      relations: ['customer', 'agency', 'branch', 'brand', 'model'],
    });

    return { vehicle: savedVehicle!, isNew: true };
  }
}

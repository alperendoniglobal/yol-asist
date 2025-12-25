import { AppDataSource } from '../config/database';
import { Vehicle } from '../entities/Vehicle';
import { AppError } from '../middlewares/errorHandler';
import { applyAgencyFilter } from '../middlewares/tenantMiddleware';

export class VehicleService {
  private vehicleRepository = AppDataSource.getRepository(Vehicle);

  /**
   * Vehicle'ı normalize et - brand ve model'i vehicle_type'a göre doldur
   * Frontend ve PDF gibi yerlerde her zaman brand ve model gelsin
   */
  normalizeVehicle(vehicle: Vehicle): any {
    if (!vehicle) return vehicle;

    const isMotorcycle = vehicle.vehicle_type === 'Motosiklet';
    
    // Normalize edilmiş vehicle objesi oluştur
    const normalized: any = {
      ...vehicle,
      // brand ve model'i vehicle_type'a göre doldur
      brand: isMotorcycle ? vehicle.motorBrand : vehicle.brand,
      model: isMotorcycle ? vehicle.motorModel : vehicle.model,
      // Orijinal ID'leri de ekle (gerekirse)
      brand_id: isMotorcycle ? vehicle.motor_brand_id : vehicle.brand_id,
      model_id: isMotorcycle ? vehicle.motor_model_id : vehicle.model_id,
    };

    return normalized;
  }

  /**
   * Birden fazla vehicle'ı normalize et
   */
  private normalizeVehicles(vehicles: Vehicle[]): any[] {
    return vehicles.map(v => this.normalizeVehicle(v));
  }

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
      .leftJoinAndSelect('vehicle.motorBrand', 'motorBrand') // Motosiklet markası
      .leftJoinAndSelect('vehicle.motorModel', 'motorModel') // Motosiklet modeli
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
    // Normalize et - brand ve model her zaman gelsin
    return this.normalizeVehicles(vehicles);
  }

  // ID ile araç getir
  async getById(id: string) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
      relations: ['customer', 'agency', 'branch', 'brand', 'model', 'motorBrand', 'motorModel'],
    });

    if (!vehicle) {
      throw new AppError(404, 'Vehicle not found');
    }

    // Normalize et - brand ve model her zaman gelsin
    return this.normalizeVehicle(vehicle);
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
      relations: ['customer', 'brand', 'model', 'motorBrand', 'motorModel'],
    });
    // Normalize et - brand ve model her zaman gelsin
    return this.normalizeVehicles(vehicles);
  }

  // Plakaya göre araç bul
  async findByPlate(plate: string) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { plate: plate.toUpperCase() },
      relations: ['customer', 'agency', 'branch', 'brand', 'model', 'motorBrand', 'motorModel'],
    });
    if (!vehicle) return null;
    // Normalize et - brand ve model her zaman gelsin
    return this.normalizeVehicle(vehicle);
  }

  // Araç bul veya oluştur (satış akışı için)
  // Plaka varsa mevcut aracı döndür, yoksa yeni oluştur
  async findOrCreate(data: Partial<Vehicle>) {
    // Plakayı büyük harfe çevir
    const plate = data.plate?.toUpperCase();
    
    // Mevcut araç var mı kontrol et
    const existingVehicle = await this.vehicleRepository.findOne({
      where: { plate },
      relations: ['customer', 'agency', 'branch', 'brand', 'model', 'motorBrand', 'motorModel'],
    });

    if (existingVehicle) {
      // Mevcut aracı normalize et ve döndür
      return { vehicle: this.normalizeVehicle(existingVehicle), isNew: false };
    }

    // Yeni araç oluştur
    const vehicle = this.vehicleRepository.create({ ...data, plate });
    await this.vehicleRepository.save(vehicle);
    
    // İlişkilerle birlikte tekrar çek
    const savedVehicle = await this.vehicleRepository.findOne({
      where: { id: vehicle.id },
      relations: ['customer', 'agency', 'branch', 'brand', 'model', 'motorBrand', 'motorModel'],
    });

    // Normalize et ve döndür
    return { vehicle: this.normalizeVehicle(savedVehicle!), isNew: true };
  }
}

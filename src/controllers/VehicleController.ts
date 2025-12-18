import { Request, Response } from 'express';
import { VehicleService } from '../services/VehicleService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class VehicleController {
  private vehicleService: VehicleService;

  constructor() {
    this.vehicleService = new VehicleService();
  }

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const vehicles = await this.vehicleService.getAll(req.tenantFilter);
    successResponse(res, vehicles, 'Vehicles retrieved successfully');
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const vehicle = await this.vehicleService.getById(id);
    successResponse(res, vehicle, 'Vehicle retrieved successfully');
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Super Admin için agency_id ve branch_id null kalır = "Sistem" kaydı
    const agency_id = req.user?.agency_id || null;
    const branch_id = req.user?.branch_id || null;

    const vehicleData = {
      ...req.body,
      agency_id,
      branch_id,
    };
    const vehicle = await this.vehicleService.create(vehicleData);
    successResponse(res, vehicle, 'Vehicle created successfully', 201);
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const vehicle = await this.vehicleService.update(id, req.body);
    successResponse(res, vehicle, 'Vehicle updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.vehicleService.delete(id);
    successResponse(res, result, 'Vehicle deleted successfully');
  });

  getByCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;
    const vehicles = await this.vehicleService.getByCustomer(customerId);
    successResponse(res, vehicles, 'Customer vehicles retrieved successfully');
  });

  // Plakaya göre araç bul
  findByPlate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { plate } = req.params;
    const vehicle = await this.vehicleService.findByPlate(plate);
    if (vehicle) {
      successResponse(res, vehicle, 'Vehicle found');
    } else {
      successResponse(res, null, 'Vehicle not found');
    }
  });

  // Araç bul veya oluştur (satış akışı için)
  findOrCreate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Super Admin için agency_id ve branch_id null kalır = "Sistem" kaydı
    const agency_id = req.user?.agency_id || null;
    const branch_id = req.user?.branch_id || null;

    const vehicleData = {
      ...req.body,
      agency_id,
      branch_id,
    };
    
    const result = await this.vehicleService.findOrCreate(vehicleData);
    const message = result.isNew ? 'Vehicle created successfully' : 'Existing vehicle found';
    successResponse(res, result, message, result.isNew ? 201 : 200);
  });
}

import { Request, Response } from 'express';
import { CustomerService } from '../services/CustomerService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const customers = await this.customerService.getAll(req.tenantFilter);
    successResponse(res, customers, 'Customers retrieved successfully');
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const customer = await this.customerService.getById(id);
    successResponse(res, customer, 'Customer retrieved successfully');
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Super Admin için agency_id ve branch_id null kalır = "Sistem" kaydı
    // Diğer kullanıcılar için kendi acentesi/şubesi atanır
    let agency_id = req.user?.agency_id || null;
    let branch_id = req.user?.branch_id || null;

    const customerData = {
      ...req.body,
      agency_id,
      branch_id,
      created_by: req.user?.id,
    };
    
    const customer = await this.customerService.create(customerData);
    successResponse(res, customer, 'Customer created successfully', 201);
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const customer = await this.customerService.update(id, req.body);
    successResponse(res, customer, 'Customer updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.customerService.delete(id);
    successResponse(res, result, 'Customer deleted successfully');
  });

  search = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { q } = req.query;
    const customers = await this.customerService.search(q as string, req.tenantFilter);
    successResponse(res, customers, 'Search results retrieved successfully');
  });

  // TC/VKN ile müşteri sorgula - geçmiş alışverişleriyle birlikte
  findByTcVkn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { tcVkn } = req.params;
    const customer = await this.customerService.findByTcVkn(tcVkn, req.tenantFilter);
    if (customer) {
      successResponse(res, customer, 'Customer found');
    } else {
      successResponse(res, null, 'Customer not found');
    }
  });
}

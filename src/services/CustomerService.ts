import { AppDataSource } from '../config/database';
import { Customer } from '../entities/Customer';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { Like } from 'typeorm';

export class CustomerService {
  private customerRepository = AppDataSource.getRepository(Customer);

  async getAll(filter?: any) {
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.agency', 'agency')
      .leftJoinAndSelect('customer.branch', 'branch')
      .leftJoinAndSelect('customer.created_by_user', 'user')
      .orderBy('customer.created_at', 'DESC');

    if (filter) {
      applyTenantFilter(queryBuilder, filter, 'customer');
    }

    const customers = await queryBuilder.getMany();
    return customers;
  }

  async getById(id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['agency', 'branch', 'created_by_user', 'vehicles'],
    });

    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }

    return customer;
  }

  async create(data: Partial<Customer>) {
    const customer = this.customerRepository.create(data);
    await this.customerRepository.save(customer);
    return customer;
  }

  async update(id: string, data: Partial<Customer>) {
    const customer = await this.customerRepository.findOne({ where: { id } });

    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }

    Object.assign(customer, data);
    await this.customerRepository.save(customer);
    return customer;
  }

  async delete(id: string) {
    const customer = await this.customerRepository.findOne({ where: { id } });

    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }

    await this.customerRepository.remove(customer);
    return { message: 'Customer deleted successfully' };
  }

  async search(query: string, filter?: any) {
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.agency', 'agency')
      .leftJoinAndSelect('customer.branch', 'branch')
      .where('customer.name LIKE :query', { query: `%${query}%` })
      .orWhere('customer.surname LIKE :query', { query: `%${query}%` })
      .orWhere('customer.tc_vkn LIKE :query', { query: `%${query}%` })
      .orWhere('customer.phone LIKE :query', { query: `%${query}%` })
      .orWhere('customer.email LIKE :query', { query: `%${query}%` });

    if (filter) {
      applyTenantFilter(queryBuilder, filter, 'customer');
    }

    const customers = await queryBuilder.take(20).getMany();
    return customers;
  }

  // TC/VKN ile müşteri sorgulama - müşterinin geçmiş alışverişlerini de getirir
  async findByTcVkn(tcVkn: string, filter?: any) {
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.agency', 'agency')
      .leftJoinAndSelect('customer.branch', 'branch')
      .leftJoinAndSelect('customer.vehicles', 'vehicles')
      .leftJoinAndSelect('vehicles.brand', 'brand')
      .leftJoinAndSelect('vehicles.model', 'model')
      .leftJoinAndSelect('customer.sales', 'sales')
      .leftJoinAndSelect('sales.package', 'package')
      .leftJoinAndSelect('sales.vehicle', 'saleVehicle')
      .where('customer.tc_vkn = :tcVkn', { tcVkn });

    if (filter) {
      applyTenantFilter(queryBuilder, filter, 'customer');
    }

    const customer = await queryBuilder.getOne();
    return customer;
  }
}

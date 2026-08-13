import { AppDataSource } from '../config/database';
import { Customer } from '../entities/Customer';
import { AppError } from '../middlewares/errorHandler';
import { Brackets } from 'typeorm';

/**
 * Müşteri listesi görünürlüğü:
 * customers.agency_id / branch_id / created_by çoğu kayıtta boş kalabiliyor
 * (mevcut müşteri yeniden kullanıldığında stamp edilmiyordu).
 * Bu yüzden görünürlük, doğrudan müşteri kolonları VEYA sales üzerinden
 * rol bazlı hesaplanır.
 */
export class CustomerService {
  private customerRepository = AppDataSource.getRepository(Customer);

  /**
   * Rol bazlı müşteri kapsamı (kayıt alanları + satış ilişkisi).
   * SUPER_ADMIN / SUPPORT: filtre yok.
   */
  private applyCustomerVisibilityFilter(queryBuilder: any, filter?: any): void {
    if (!filter?.userRole) {
      return;
    }

    const role = filter.userRole;

    if (role === 'SUPER_ADMIN' || role === 'SUPPORT') {
      return;
    }

    if (role === 'SUPER_AGENCY_ADMIN') {
      const managed = filter.managed_agency_ids || [];
      if (managed.length === 0) {
        queryBuilder.andWhere('1 = 0');
        return;
      }
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('customer.agency_id IN (:...managedAgencyIds)', {
            managedAgencyIds: managed,
          }).orWhere(
            `EXISTS (
              SELECT 1 FROM sales s
              WHERE s.customer_id = customer.id
                AND s.agency_id IN (:...managedAgencyIds)
            )`
          );
        })
      );
      return;
    }

    if (role === 'AGENCY_ADMIN') {
      if (!filter.agency_id) {
        queryBuilder.andWhere('1 = 0');
        return;
      }
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('customer.agency_id = :agency_id', {
            agency_id: filter.agency_id,
          }).orWhere(
            `EXISTS (
              SELECT 1 FROM sales s
              WHERE s.customer_id = customer.id
                AND s.agency_id = :agency_id
            )`
          );
        })
      );
      return;
    }

    if (role === 'BRANCH_ADMIN') {
      if (filter.branch_id) {
        // Şube yöneticisi: şubesine kayıtlı veya şubesinde satışı olan müşteriler
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where('customer.branch_id = :branch_id', {
              branch_id: filter.branch_id,
            }).orWhere(
              `EXISTS (
                SELECT 1 FROM sales s
                WHERE s.customer_id = customer.id
                  AND s.branch_id = :branch_id
              )`
            );
          })
        );
        return;
      }
      if (filter.agency_id) {
        // Merkez BRANCH_ADMIN: tüm acente müşterileri
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where('customer.agency_id = :agency_id', {
              agency_id: filter.agency_id,
            }).orWhere(
              `EXISTS (
                SELECT 1 FROM sales s
                WHERE s.customer_id = customer.id
                  AND s.agency_id = :agency_id
              )`
            );
          })
        );
        return;
      }
      queryBuilder.andWhere('1 = 0');
      return;
    }

    if (role === 'BRANCH_USER') {
      // Şube/merkez çalışanı: kendi oluşturduğu veya kendi sattığı müşteriler
      if (!filter.created_by) {
        queryBuilder.andWhere('1 = 0');
        return;
      }
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('customer.created_by = :created_by', {
            created_by: filter.created_by,
          }).orWhere(
            `EXISTS (
              SELECT 1 FROM sales s
              WHERE s.customer_id = customer.id
                AND s.user_id = :created_by
            )`
          );
        })
      );
      return;
    }

    // Bilinmeyen rol: güvenli tarafta kal
    queryBuilder.andWhere('1 = 0');
  }

  async getAll(filter?: any) {
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.agency', 'agency')
      .leftJoinAndSelect('customer.branch', 'branch')
      .leftJoinAndSelect('customer.created_by_user', 'user')
      .orderBy('customer.created_at', 'DESC');

    this.applyCustomerVisibilityFilter(queryBuilder, filter);

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
    // MySQL DATE sütunu boş string kabul etmez; boş/geçersiz ise null yap
    const normalized = { ...data };
    if (normalized.birth_date !== undefined && normalized.birth_date !== null) {
      const v = normalized.birth_date;
      const asStr = typeof v === 'string' ? (v as string).trim() : '';
      if (asStr === '' || asStr === 'undefined' || asStr === 'null') {
        (normalized as any).birth_date = null;
      }
    }
    const customer = this.customerRepository.create(normalized);
    await this.customerRepository.save(customer);
    return customer;
  }

  async update(id: string, data: Partial<Customer>) {
    const customer = await this.customerRepository.findOne({ where: { id } });

    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }

    // MySQL DATE sütunu boş string kabul etmez; boş/geçersiz ise null yap
    const normalized = { ...data };
    if (normalized.birth_date !== undefined && normalized.birth_date !== null) {
      const v = normalized.birth_date;
      const asStr = typeof v === 'string' ? (v as string).trim() : '';
      if (asStr === '' || asStr === 'undefined' || asStr === 'null') {
        (normalized as any).birth_date = null;
      }
    }

    Object.assign(customer, normalized);
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
      .where(
        new Brackets((qb) => {
          qb.where('customer.name LIKE :query', { query: `%${query}%` })
            .orWhere('customer.surname LIKE :query', { query: `%${query}%` })
            .orWhere('customer.tc_vkn LIKE :query', { query: `%${query}%` })
            .orWhere('customer.phone LIKE :query', { query: `%${query}%` })
            .orWhere('customer.email LIKE :query', { query: `%${query}%` });
        })
      );

    this.applyCustomerVisibilityFilter(queryBuilder, filter);

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

    this.applyCustomerVisibilityFilter(queryBuilder, filter);

    const customer = await queryBuilder.getOne();
    return customer;
  }
}

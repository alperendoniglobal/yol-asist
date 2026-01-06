import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/enums';
import { AppDataSource } from '../config/database';
import { UserAgency } from '../entities/UserAgency';

/**
 * Multi-tenancy middleware that automatically filters data based on user role:
 * - SUPER_ADMIN: No filter (can see all data)
 * - SUPPORT: No filter (can see all data - global support role)
 * - SUPER_AGENCY_ADMIN: Filter by selected agency_id (can manage multiple agencies)
 * - AGENCY_ADMIN: Filter by agency_id
 * - BRANCH_ADMIN: Filter by agency_id + branch_id
 * - BRANCH_USER: Filter by agency_id + branch_id + created_by
 */
export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Initialize tenant filter
  req.tenantFilter = {
    userRole: req.user.role, // User role'ü filtreye ekle (SUPER_AGENCY_ADMIN kontrolü için)
  };

  switch (req.user.role) {
    case UserRole.SUPER_ADMIN:
      // SUPER_ADMIN can see all data - no filter applied
      break;

    case UserRole.SUPPORT:
      // SUPPORT can see all data - no filter applied (global support role)
      break;

    case UserRole.SUPER_AGENCY_ADMIN:
      // SUPER_AGENCY_ADMIN can manage multiple agencies
      // Get user's managed agencies from junction table
      const userAgencyRepository = AppDataSource.getRepository(UserAgency);
      const userAgencies = await userAgencyRepository.find({
        where: { user_id: req.user.id },
      });
      
      const managedAgencyIdsSuper = userAgencies.map(ua => ua.agency_id);
      
      // SUPER_AGENCY_ADMIN tüm yönettiği brokerların verilerini görebilir (SUPER_ADMIN gibi)
      // Filtreleme yapmıyoruz, sadece managedAgencyIds'i saklıyoruz (güvenlik için)
      if (managedAgencyIdsSuper.length > 0) {
        // Tüm yönettiği brokerları dahil etmek için managed_agency_ids'i sakla
        req.tenantFilter.managed_agency_ids = managedAgencyIdsSuper;
        // agency_id'yi undefined bırak ki tüm yönettiği brokerların verileri gelsin
        req.tenantFilter.agency_id = undefined;
      } else {
        // Hiç broker yoksa, tenantFilter'ı boş bırak
        req.tenantFilter.agency_id = undefined;
        req.tenantFilter.managed_agency_ids = [];
      }
      break;

    case UserRole.AGENCY_ADMIN:
      // AGENCY_ADMIN - Tek bir acenteyi yönetir (agency_id üzerinden)
      if (!req.user.agency_id) {
        res.status(403).json({ 
          error: 'Acente yöneticisi için acente atanmamış',
          message: 'Lütfen sistem yöneticisi ile iletişime geçin'
        });
        return;
      }
      req.tenantFilter.agency_id = req.user.agency_id;
      break;

    case UserRole.BRANCH_ADMIN:
      // BRANCH_ADMIN - Şube yöneticisi veya merkez yöneticisi
      // Şubesi varsa şube verisini, yoksa tüm acente verisini görür
      if (!req.user.agency_id) {
        res.status(403).json({ error: 'Branch admin must have agency assigned' });
        return;
      }
      req.tenantFilter.agency_id = req.user.agency_id;
      // Şubesi varsa sadece şube verisini görür, yoksa merkez çalışanı olarak tüm acenteyi görür
      if (req.user.branch_id) {
      req.tenantFilter.branch_id = req.user.branch_id;
      }
      break;

    case UserRole.BRANCH_USER:
      // BRANCH_USER - Şube çalışanı veya merkez çalışanı
      // Şubesi varsa şube verisini, yoksa acente verisini görür (kendi işlemleri)
      if (!req.user.agency_id) {
        res.status(403).json({ error: 'Branch user must have agency assigned' });
        return;
      }
      req.tenantFilter.agency_id = req.user.agency_id;
      // Şubesi varsa şube filtresi de uygula
      if (req.user.branch_id) {
      req.tenantFilter.branch_id = req.user.branch_id;
      }
      req.tenantFilter.created_by = req.user.id;
      break;

    default:
      res.status(403).json({ error: 'Invalid user role' });
      return;
  }

  next();
};

/**
 * Helper function to apply tenant filter to a query builder
 * Usage: applyTenantFilter(queryBuilder, req.tenantFilter, 'entity')
 * 
 * @param queryBuilder - TypeORM query builder
 * @param filter - Tenant filter object from req.tenantFilter
 * @param alias - Entity alias in the query
 * @param userIdColumn - Column name for user/creator ID (default: 'created_by', use 'user_id' for Sale)
 */
export const applyTenantFilter = (
  queryBuilder: any,
  filter: any,
  alias: string,
  userIdColumn: string = 'created_by'
): void => {
  // SUPER_AGENCY_ADMIN için özel kontrol: Tüm yönettiği brokerların verilerini göster
  if (filter.userRole === 'SUPER_AGENCY_ADMIN' && filter.managed_agency_ids) {
    if (filter.managed_agency_ids.length > 0) {
      // Tüm yönettiği brokerları dahil et
      queryBuilder.andWhere(`${alias}.agency_id IN (:...managedAgencyIds)`, {
        managedAgencyIds: filter.managed_agency_ids,
      });
    } else {
      // Hiç broker yoksa hiçbir veri gösterilmemeli
      queryBuilder.andWhere('1 = 0');
      return; // Hiç broker yoksa diğer filtreleri uygulamaya gerek yok
    }
    // SUPER_AGENCY_ADMIN için normal agency_id filtresi uygulanmaz, ama branch_id ve created_by uygulanabilir
    // return yapmıyoruz, branch_id ve created_by filtreleri de uygulanabilir
  } else {
    // SUPER_AGENCY_ADMIN için özel kontrol: Eğer agency_id undefined ise ve managed_agency_ids yoksa hiçbir veri gösterilmemeli
    if (filter.agency_id === undefined && filter.userRole === 'SUPER_AGENCY_ADMIN' && !filter.managed_agency_ids) {
      // Hiçbir veri döndürmemek için her zaman false olan bir koşul ekle
      queryBuilder.andWhere('1 = 0');
      return;
    }

    // Agency filtresi uygula
    if (filter.agency_id) {
      queryBuilder.andWhere(`${alias}.agency_id = :agency_id`, {
        agency_id: filter.agency_id,
      });
    }
  }

  // Branch filtresi uygula (tüm roller için)
  if (filter.branch_id) {
    queryBuilder.andWhere(`${alias}.branch_id = :branch_id`, {
      branch_id: filter.branch_id,
    });
  }

  // User/creator filtresi uygula (kullanıcı bazlı filtreleme için)
  if (filter.created_by) {
    queryBuilder.andWhere(`${alias}.${userIdColumn} = :created_by`, {
      created_by: filter.created_by,
    });
  }
};

/**
 * Helper function to apply agency-only filter (for entities without branch_id/created_by)
 * Usage: applyAgencyFilter(queryBuilder, req.tenantFilter, 'payment')
 */
export const applyAgencyFilter = (
  queryBuilder: any,
  filter: any,
  alias: string
): void => {
  // SUPER_AGENCY_ADMIN için özel kontrol: Tüm yönettiği brokerların verilerini göster
  if (filter.userRole === 'SUPER_AGENCY_ADMIN' && filter.managed_agency_ids) {
    if (filter.managed_agency_ids.length > 0) {
      // Tüm yönettiği brokerları dahil et
      queryBuilder.andWhere(`${alias}.agency_id IN (:...managedAgencyIds)`, {
        managedAgencyIds: filter.managed_agency_ids,
      });
    } else {
      // Hiç broker yoksa hiçbir veri gösterilmemeli
      queryBuilder.andWhere('1 = 0');
    }
    return;
  }

  if (filter.agency_id) {
    queryBuilder.andWhere(`${alias}.agency_id = :agency_id`, {
      agency_id: filter.agency_id,
    });
  }
};

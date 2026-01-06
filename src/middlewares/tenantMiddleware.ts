import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/enums';

/**
 * Multi-tenancy middleware that automatically filters data based on user role:
 * - SUPER_ADMIN: No filter (can see all data)
 * - SUPPORT: No filter (can see all data - global support role)
 * - AGENCY_ADMIN: Filter by agency_id
 * - BRANCH_ADMIN: Filter by agency_id + branch_id
 * - BRANCH_USER: Filter by agency_id + branch_id + created_by
 */
export const tenantMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Initialize tenant filter
  req.tenantFilter = {};

  switch (req.user.role) {
    case UserRole.SUPER_ADMIN:
      // SUPER_ADMIN can see all data - no filter applied
      break;

    case UserRole.SUPPORT:
      // SUPPORT can see all data - no filter applied (global support role)
      break;

    case UserRole.AGENCY_ADMIN:
      // AGENCY_ADMIN can manage multiple agencies
      // Read selected agency ID from header (case-insensitive)
      const selectedAgencyId = (req.headers['x-selected-agency-id'] || 
                                req.headers['X-Selected-Agency-Id'] ||
                                req.headers['X-SELECTED-AGENCY-ID']) as string;
      
      // Get user's managed agencies
      const managedAgencyIds = req.user.managed_agency_ids || [];
      
      // If user has managed agencies
      if (managedAgencyIds.length > 0) {
        // If header provides an agency ID, validate it
        if (selectedAgencyId && selectedAgencyId.trim() !== '') {
          // Security check: verify user can manage the selected agency
          if (managedAgencyIds.includes(selectedAgencyId.trim())) {
            req.tenantFilter.agency_id = selectedAgencyId.trim();
          } else {
            res.status(403).json({ 
              error: 'Bu acenteyi yönetme yetkiniz yok',
              message: 'Seçilen acente, yönettiğiniz acenteler listesinde bulunmuyor'
            });
            return;
          }
        } else {
          // No header provided, use first managed agency as default
          req.tenantFilter.agency_id = managedAgencyIds[0];
        }
      } else {
        // Fallback: use old agency_id if managed_agency_ids is empty (backward compatibility)
        if (req.user.agency_id) {
          req.tenantFilter.agency_id = req.user.agency_id;
        } else {
          res.status(403).json({ 
            error: 'Acente yöneticisi için acente atanmamış',
            message: 'Lütfen sistem yöneticisi ile iletişime geçin'
          });
          return;
        }
      }
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
  // Agency filtresi uygula
  if (filter.agency_id) {
    queryBuilder.andWhere(`${alias}.agency_id = :agency_id`, {
      agency_id: filter.agency_id,
    });
  }

  // Branch filtresi uygula
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
  if (filter.agency_id) {
    queryBuilder.andWhere(`${alias}.agency_id = :agency_id`, {
      agency_id: filter.agency_id,
    });
  }
};

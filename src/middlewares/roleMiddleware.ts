import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/enums';

export const roleMiddleware = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource'
      });
      return;
    }

    next();
  };
};

// Convenience middleware for specific roles
export const superAdminOnly = roleMiddleware([UserRole.SUPER_ADMIN]);
export const supportOrAbove = roleMiddleware([UserRole.SUPER_ADMIN, UserRole.SUPPORT]);
export const agencyAdminOrAbove = roleMiddleware([UserRole.SUPER_ADMIN, UserRole.SUPPORT, UserRole.AGENCY_ADMIN]);
export const branchAdminOrAbove = roleMiddleware([
  UserRole.SUPER_ADMIN,
  UserRole.SUPPORT,
  UserRole.AGENCY_ADMIN,
  UserRole.BRANCH_ADMIN,
]);
export const allRoles = roleMiddleware([
  UserRole.SUPER_ADMIN,
  UserRole.SUPPORT,
  UserRole.AGENCY_ADMIN,
  UserRole.BRANCH_ADMIN,
  UserRole.BRANCH_USER,
]);

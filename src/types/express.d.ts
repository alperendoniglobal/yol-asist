import { User } from '../entities/User';
import { UserCustomer } from '../entities/UserCustomer';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      // Bireysel kullanıcı için (UserCustomer)
      userCustomer?: UserCustomer;
      userCustomerId?: string;
      tenantFilter?: {
        agency_id?: string;
        branch_id?: string;
        created_by?: string;
        userRole?: string; // User role'ü (SUPER_AGENCY_ADMIN kontrolü için)
        managed_agency_ids?: string[]; // SUPER_AGENCY_ADMIN için yönettiği broker ID'leri
      };
    }
  }
}

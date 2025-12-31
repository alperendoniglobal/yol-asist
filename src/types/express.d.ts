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
      };
    }
  }
}

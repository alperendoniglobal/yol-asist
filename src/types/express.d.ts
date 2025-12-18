import { User } from '../entities/User';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      tenantFilter?: {
        agency_id?: string;
        branch_id?: string;
        created_by?: string;
      };
    }
  }
}

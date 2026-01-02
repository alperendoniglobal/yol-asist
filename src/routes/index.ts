import { Router } from 'express';
import authRoutes from './authRoutes';
import agencyRoutes from './agencyRoutes';
import branchRoutes from './branchRoutes';
import userRoutes from './userRoutes';
import customerRoutes from './customerRoutes';
import vehicleRoutes from './vehicleRoutes';
import carBrandRoutes from './carBrandRoutes';
import carModelRoutes from './carModelRoutes';
import motorBrandRoutes from './motorBrandRoutes';
import motorModelRoutes from './motorModelRoutes';
import packageRoutes from './packageRoutes';
import saleRoutes from './saleRoutes';
import paymentRoutes from './paymentRoutes';
import commissionRoutes from './commissionRoutes';
import supportRoutes from './supportRoutes';
import supportFileRoutes from './supportFileRoutes';
import statsRoutes from './statsRoutes';
import pdfRoutes from './pdfRoutes';
import contentRoutes from './contentRoutes';
import publicRoutes from './publicRoutes';
import dealerApplicationRoutes from './dealerApplicationRoutes';
import userCustomerRoutes from './userCustomerRoutes';
import contractRoutes from './contractRoutes';

const router = Router();

// Public Routes (authentication gerektirmez)
router.use('/public', publicRoutes);

// UserCustomer Routes (bireysel kullanıcılar için)
router.use('/user-customer', userCustomerRoutes);

// API Routes
router.use('/auth', authRoutes);
router.use('/agencies', agencyRoutes);
router.use('/branches', branchRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/car-brands', carBrandRoutes);
router.use('/car-models', carModelRoutes);
router.use('/motor-brands', motorBrandRoutes);
router.use('/motor-models', motorModelRoutes);
router.use('/packages', packageRoutes);
router.use('/sales', saleRoutes);
router.use('/payments', paymentRoutes);
router.use('/commissions', commissionRoutes);
router.use('/support', supportRoutes);
router.use('/support-files', supportFileRoutes);
router.use('/stats', statsRoutes);
router.use('/pdf', pdfRoutes);
router.use('/content', contentRoutes);
router.use('/dealer-applications', dealerApplicationRoutes);
router.use('/contract', contractRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default router;

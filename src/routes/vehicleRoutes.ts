import { Router } from 'express';
import { VehicleController } from '../controllers/VehicleController';
import { authMiddleware, tenantMiddleware, allRoles } from '../middlewares';

const router = Router();
const vehicleController = new VehicleController();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);

// Custom routes (önce tanımlanmalı - :id ile çakışmasın)
router.get('/plate/:plate', vehicleController.findByPlate);        // Plakaya göre araç bul
router.get('/customer/:customerId', vehicleController.getByCustomer);  // Müşteriye göre araçlar
router.post('/find-or-create', allRoles, vehicleController.findOrCreate);  // Bul veya oluştur (satış için)

// CRUD operations
router.get('/', vehicleController.getAll);
router.get('/:id', vehicleController.getById);
router.post('/', allRoles, vehicleController.create);
router.put('/:id', allRoles, vehicleController.update);
router.delete('/:id', allRoles, vehicleController.delete);

export default router;

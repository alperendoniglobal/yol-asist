import { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController';
import { authMiddleware, tenantMiddleware, allRoles } from '../middlewares';

const router = Router();
const customerController = new CustomerController();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);

// CRUD operations
router.get('/', customerController.getAll);
router.get('/search', customerController.search);
router.get('/tc/:tcVkn', customerController.findByTcVkn); // TC/VKN ile sorgula
router.get('/:id', customerController.getById);
router.post('/', allRoles, customerController.create);
router.put('/:id', allRoles, customerController.update);
router.delete('/:id', allRoles, customerController.delete);

export default router;

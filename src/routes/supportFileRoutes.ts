import { Router } from 'express';
import { SupportFileController } from '../controllers/SupportFileController';
import { authMiddleware, tenantMiddleware, allRoles } from '../middlewares';

const router = Router();
const fileController = new SupportFileController();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);

// Support file operations
router.get('/', fileController.getAll);
router.get('/sale/:saleId', fileController.getBySaleId);
router.get('/:id', fileController.getById);
router.post('/', allRoles, fileController.create);
router.put('/:id', allRoles, fileController.update);
router.delete('/:id', allRoles, fileController.delete);

export default router;









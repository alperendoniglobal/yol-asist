import { Router } from 'express';
import { SupportController } from '../controllers/SupportController';
import { authMiddleware, tenantMiddleware, allRoles } from '../middlewares';

const router = Router();
const supportController = new SupportController();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);

// Ticket operations
router.get('/', supportController.getAllTickets);
router.get('/:id', supportController.getTicketById);
router.post('/', allRoles, supportController.createTicket);
router.put('/:id/status', supportController.updateTicketStatus);

// Message operations
router.get('/:id/messages', supportController.getMessages);
router.post('/:id/messages', allRoles, supportController.addMessage);

export default router;

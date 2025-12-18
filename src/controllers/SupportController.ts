import { Request, Response } from 'express';
import { SupportService } from '../services/SupportService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/response';

export class SupportController {
  private supportService: SupportService;

  constructor() {
    this.supportService = new SupportService();
  }

  getAllTickets = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tickets = await this.supportService.getAllTickets(req.tenantFilter);
    successResponse(res, tickets, 'Support tickets retrieved successfully');
  });

  getTicketById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const ticket = await this.supportService.getTicketById(id);
    successResponse(res, ticket, 'Support ticket retrieved successfully');
  });

  createTicket = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ticketData = {
      ...req.body,
      agency_id: req.user?.agency_id,
      branch_id: req.user?.branch_id,
      user_id: req.user?.id,
    };
    const ticket = await this.supportService.createTicket(ticketData);
    successResponse(res, ticket, 'Support ticket created successfully', 201);
  });

  updateTicketStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;
    const ticket = await this.supportService.updateTicketStatus(id, status);
    successResponse(res, ticket, 'Support ticket status updated successfully');
  });

  addMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const messageData = {
      ...req.body,
      sender_id: req.user?.id,
    };
    const message = await this.supportService.addMessage(id, messageData);
    successResponse(res, message, 'Message added successfully', 201);
  });

  getMessages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const messages = await this.supportService.getMessages(id);
    successResponse(res, messages, 'Messages retrieved successfully');
  });
}

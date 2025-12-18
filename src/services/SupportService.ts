import { AppDataSource } from '../config/database';
import { SupportTicket } from '../entities/SupportTicket';
import { SupportMessage } from '../entities/SupportMessage';
import { AppError } from '../middlewares/errorHandler';
import { applyTenantFilter } from '../middlewares/tenantMiddleware';
import { TicketStatus } from '../types/enums';

export class SupportService {
  private ticketRepository = AppDataSource.getRepository(SupportTicket);
  private messageRepository = AppDataSource.getRepository(SupportMessage);

  async getAllTickets(filter?: any) {
    const queryBuilder = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.agency', 'agency')
      .leftJoinAndSelect('ticket.branch', 'branch')
      .leftJoinAndSelect('ticket.user', 'user')
      .orderBy('ticket.created_at', 'DESC');

    // SupportTicket entity'sinde created_by yok, user_id var
    // Bu yüzden özel filtreleme yapıyoruz
    if (filter) {
      if (filter.agency_id) {
        queryBuilder.andWhere('ticket.agency_id = :agency_id', { agency_id: filter.agency_id });
      }
      if (filter.branch_id) {
        queryBuilder.andWhere('ticket.branch_id = :branch_id', { branch_id: filter.branch_id });
      }
      // created_by yerine user_id kullan
      if (filter.created_by) {
        queryBuilder.andWhere('ticket.user_id = :user_id', { user_id: filter.created_by });
      }
    }

    const tickets = await queryBuilder.getMany();
    return tickets;
  }

  async getTicketById(id: string) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: ['agency', 'branch', 'user', 'messages', 'messages.sender'],
    });

    if (!ticket) {
      throw new AppError(404, 'Support ticket not found');
    }

    return ticket;
  }

  async createTicket(data: Partial<SupportTicket>) {
    const ticket = this.ticketRepository.create({
      ...data,
      status: TicketStatus.OPEN,
    });
    await this.ticketRepository.save(ticket);
    return ticket;
  }

  async updateTicketStatus(id: string, status: string) {
    const ticket = await this.ticketRepository.findOne({ where: { id } });

    if (!ticket) {
      throw new AppError(404, 'Support ticket not found');
    }

    ticket.status = status as TicketStatus;

    if (status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED) {
      ticket.resolved_at = new Date();
    }

    await this.ticketRepository.save(ticket);
    return ticket;
  }

  async addMessage(ticketId: string, data: Partial<SupportMessage>) {
    const ticket = await this.ticketRepository.findOne({ where: { id: ticketId } });

    if (!ticket) {
      throw new AppError(404, 'Support ticket not found');
    }

    const message = this.messageRepository.create({
      ...data,
      ticket_id: ticketId,
    });

    await this.messageRepository.save(message);

    // Update ticket status if it was closed
    if (ticket.status === TicketStatus.CLOSED) {
      ticket.status = TicketStatus.IN_PROGRESS;
      await this.ticketRepository.save(ticket);
    }

    return message;
  }

  async getMessages(ticketId: string) {
    const messages = await this.messageRepository.find({
      where: { ticket_id: ticketId },
      relations: ['sender'],
      order: { created_at: 'ASC' },
    });

    return messages;
  }
}

import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
  ) { }

  async findAll(
    companyId: string,
    status?: ConversationStatus,
    user?: { role: string; departmentId?: string | null },
  ) {
    const where: any = { companyId, ...(status && { status }) };
    if (user && user.role !== 'ADMIN' && user.departmentId) {
      where.departmentId = user.departmentId;
    }
    return this.prisma.conversation.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, slug: true, color: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        assignments: {
          where: { unassignedAt: null },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            direction: true,
            sentAt: true,
            type: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async findOne(id: string, user?: { role: string; departmentId?: string | null }) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, slug: true, color: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        assignments: {
          where: { unassignedAt: null },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa nao encontrada');
    }

    if (user && user.role !== 'ADMIN' && user.departmentId) {
      if (conversation.departmentId !== user.departmentId) {
        throw new ForbiddenException('Acesso negado a esta conversa');
      }
    }

    return conversation;
  }

  async getMessages(
    conversationId: string,
    take = 50,
    cursor?: string,
    user?: { role: string; departmentId?: string | null },
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, departmentId: true },
    });
    if (!conv) throw new NotFoundException('Conversa nao encontrada');
    if (user && user.role !== 'ADMIN' && user.departmentId) {
      if (conv.departmentId !== user.departmentId) {
        throw new ForbiddenException('Acesso negado a esta conversa');
      }
    }
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'desc' },
      take,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      include: {
        sentBy: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async assign(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { department: true },
    });
    if (!conv) throw new NotFoundException('Conversa nao encontrada');
    const agent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    if (!agent || (conv.departmentId && agent.departmentId !== conv.departmentId)) {
      throw new ForbiddenException('Usuario nao pertence ao setor da conversa');
    }

    await this.prisma.assignment.updateMany({
      where: { conversationId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    await this.prisma.assignment.create({
      data: { conversationId, userId },
    });

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'ASSIGNED',
        assignedUserId: userId,
        assignedAt: new Date(),
        flowState: 'ASSIGNED',
      },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    return updated;
  }

  async unassign(conversationId: string) {
    await this.prisma.assignment.updateMany({
      where: { conversationId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'OPEN', assignedUserId: null },
    });

    return { message: 'Conversa desatribuida' };
  }

  async transfer(
    conversationId: string,
    departmentId: string,
    userId?: string,
    currentUser: { companyId: string; role: string } = { companyId: '', role: 'AGENT' },
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || conv.companyId !== currentUser.companyId) {
      throw new NotFoundException('Conversa nao encontrada');
    }
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId: currentUser.companyId },
    });
    if (!dept) throw new NotFoundException('Departamento nao encontrado');

    const updateData: any = {
      departmentId,
      assignedUserId: null,
      assignedAt: null,
      flowState: 'DEPARTMENT_SELECTED',
      routedAt: new Date(),
      timeoutAt: new Date(Date.now() + dept.responseTimeoutMinutes * 60 * 1000),
    };
    if (userId) {
      const agent = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      if (agent?.departmentId === departmentId) {
        updateData.assignedUserId = userId;
        updateData.assignedAt = new Date();
        updateData.flowState = 'ASSIGNED';
      }
    }
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      include: {
        department: true,
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateStatus(conversationId: string, status: ConversationStatus) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });
  }

  /**
   * Resolve a conversation and fully reset its state so the bot restarts
   * from the beginning when the client contacts again.
   */
  async resolve(
    conversationId: string,
    sendClosingMessage = true,
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { company: true },
    });
    if (!conv) throw new NotFoundException('Conversa nao encontrada');

    // Send closing message before resetting state
    if (sendClosingMessage) {
      try {
        const to = (conv.metadata as any)?.chatId || conv.customerPhone;
        const closingText =
          conv.company.greetingMessage
            ? `Atendimento encerrado. Obrigado por entrar em contato! 😊`
            : `Atendimento encerrado. Obrigado por entrar em contato! 😊\n\nSe precisar de mais ajuda, é só nos chamar novamente.`;
        await this.whatsappService.sendTextMessage(
          conv.company.whatsappAccessToken,
          conv.company.whatsappPhoneNumberId,
          to,
          closingText,
        );
      } catch (err: any) {
        this.logger.warn(`[RESOLVE] Falha ao enviar mensagem de encerramento: ${err.message}`);
      }
    }

    // Close all active assignments
    await this.prisma.assignment.updateMany({
      where: { conversationId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    // Reset conversation state completely so bot restarts on next contact
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'RESOLVED',
        flowState: 'GREETING',
        greetingSentAt: null,
        assignedUserId: null,
        assignedAt: null,
        departmentId: null,
        routedAt: null,
        timeoutAt: null,
        unreadCount: 0,
      },
    });
  }

  async markAsRead(conversationId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }

  async updateCustomerName(
    conversationId: string,
    customerName: string | null,
  ) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { customerName: customerName || null },
    });
  }
}

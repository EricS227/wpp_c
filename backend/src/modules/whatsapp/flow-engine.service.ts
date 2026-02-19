import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { DepartmentRoutingService } from '../departments/department-routing.service';

/**
 * Maps user input to department slugs.
 * Numbers match the order in the default greeting:
 *   1 - Laboratório
 *   2 - Comercial
 *   3 - Financeiro
 *   4 - Administrativo
 */
const MENU_ALIASES: Record<string, string> = {
  // Laboratório
  '1': 'laboratorio',
  'lab': 'laboratorio',
  'laboratorio': 'laboratorio',
  'laudo': 'laboratorio',
  'analise': 'laboratorio',
  'qualidade': 'laboratorio',
  'tecnico': 'laboratorio',

  // Comercial
  '2': 'comercial',
  'comercial': 'comercial',
  'vendas': 'comercial',
  'venda': 'comercial',
  'pedido': 'comercial',
  'cotacao': 'comercial',
  'compra': 'comercial',
  'preco': 'comercial',

  // Financeiro
  '3': 'financeiro',
  'financeiro': 'financeiro',
  'financ': 'financeiro',
  'boleto': 'financeiro',
  'nota': 'financeiro',
  'nf': 'financeiro',
  'pagamento': 'financeiro',
  'fatura': 'financeiro',
  'cobranca': 'financeiro',

  // Administrativo (root dept — fallback)
  '4': 'administrativo',
  'adm': 'administrativo',
  'admin': 'administrativo',
  'administrativo': 'administrativo',
  'rh': 'administrativo',
  'recursos humanos': 'administrativo',
  'fornecedor': 'administrativo',
  'geral': 'administrativo',
};

function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

@Injectable()
export class FlowEngineService {
  private readonly logger = new Logger(FlowEngineService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private departmentRoutingService: DepartmentRoutingService,
  ) { }

  processMenuChoice(input: string): string | null {
    const key = normalizeInput(input);
    return MENU_ALIASES[key] ?? null;
  }

  /**
   * Resolve the department slug to the actual department for a given company.
   * If the exact slug is not found, falls back to the root (isRoot=true) department.
   */
  async resolveDepartmentSlug(
    companyId: string,
    slug: string,
  ): Promise<{ id: string; slug: string; name: string } | null> {
    // Try exact slug match first
    const dept = await this.prisma.department.findFirst({
      where: { companyId, slug, isActive: true },
      select: { id: true, slug: true, name: true },
    });
    if (dept) return dept;

    // If slug is 'administrativo' and not found, fall back to root department
    if (slug === 'administrativo') {
      const root = await this.prisma.department.findFirst({
        where: { companyId, isRoot: true, isActive: true },
        select: { id: true, slug: true, name: true },
      });
      if (root) {
        this.logger.log(
          `[FLOW] Slug 'administrativo' not found for company ${companyId}, using root dept: ${root.name} (${root.slug})`,
        );
        return root;
      }
    }

    this.logger.warn(
      `[FLOW] No department found for slug '${slug}' in company ${companyId}`,
    );
    return null;
  }

  getDefaultGreeting(companyName: string): string {
    return (
      `Olá! Bem-vindo a ${companyName}!\n\nComo podemos ajudar?\n` +
      '1 - Laboratório\n2 - Comercial\n3 - Financeiro\n4 - Administrativo'
    );
  }

  async sendGreeting(conversation: {
    id: string;
    companyId: string;
    company?: { name: string; greetingMessage?: string | null };
  }) {
    const company = await this.prisma.company.findUnique({
      where: { id: conversation.companyId },
      select: { name: true, greetingMessage: true },
    });
    const text =
      company?.greetingMessage?.trim() ||
      this.getDefaultGreeting(company?.name || 'nosso atendimento');

    const fullConv = await this.prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: { company: true },
    });
    if (!fullConv) return;

    const meta = (fullConv.metadata as any) || {};
    const sendTo = meta.chatId || fullConv.customerPhone;

    await this.whatsappService.sendTextMessage(
      fullConv.company.whatsappAccessToken,
      fullConv.company.whatsappPhoneNumberId,
      sendTo,
      text,
    );

    await this.prisma.message.create({
      data: {
        companyId: fullConv.companyId,
        conversationId: fullConv.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: text,
        status: 'SENT',
        isBot: true,
      },
    });
  }

  async handleInvalidChoice(conversation: {
    id: string;
    companyId: string;
    company?: { name: string };
  }) {
    const fullConv = await this.prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: { company: true },
    });
    if (!fullConv) return;

    const meta = (fullConv.metadata as any) || {};
    const sendTo = meta.chatId || fullConv.customerPhone;

    const invalidText =
      'Opção inválida. Por favor escolha 1, 2, 3 ou 4.';
    const menuText = fullConv.company.greetingMessage?.trim() ||
      this.getDefaultGreeting(fullConv.company.name);

    await this.whatsappService.sendTextMessage(
      fullConv.company.whatsappAccessToken,
      fullConv.company.whatsappPhoneNumberId,
      sendTo,
      invalidText,
    );
    await this.prisma.message.create({
      data: {
        companyId: fullConv.companyId,
        conversationId: fullConv.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: invalidText,
        status: 'SENT',
        isBot: true,
      },
    });

    await this.whatsappService.sendTextMessage(
      fullConv.company.whatsappAccessToken,
      fullConv.company.whatsappPhoneNumberId,
      sendTo,
      menuText,
    );
    await this.prisma.message.create({
      data: {
        companyId: fullConv.companyId,
        conversationId: fullConv.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: menuText,
        status: 'SENT',
        isBot: true,
      },
    });
  }
}

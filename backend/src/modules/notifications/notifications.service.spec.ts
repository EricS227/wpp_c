import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockWebsocketGateway: jest.Mocked<WebsocketGateway>;

  beforeEach(async () => {
    // Mock do WebsocketGateway
    mockWebsocketGateway = {
      emitToDepartment: jest.fn(),
      emitToCompany: jest.fn(),
      emitToUser: jest.fn(),
      emitToConversation: jest.fn(),
      server: {},
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: 'WebsocketGateway',
          useValue: mockWebsocketGateway,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    // Mock do ModuleRef para retornar o gateway mockado
    (service['moduleRef'] as any) = {
      get: jest.fn().mockReturnValue(mockWebsocketGateway),
    };
  });

  describe('notifyNewConversation', () => {
    it('deve emitir notificação de nova conversa para o departamento', async () => {
      const payload = {
        conversationId: 'conv-123',
        customerName: 'João Silva',
        customerPhone: '+5511999999999',
        departmentId: 'dept-456',
        departmentName: 'Suporte',
        timestamp: new Date(),
      };

      await service.notifyNewConversation(payload);

      expect(mockWebsocketGateway.emitToDepartment).toHaveBeenCalledWith(
        'dept-456',
        'new_conversation',
        expect.objectContaining({
          conversationId: 'conv-123',
          customerName: 'João Silva',
          customerPhone: '+5511999999999',
          departmentName: 'Suporte',
        }),
      );
    });

    it('deve incluir timestamp na notificação', async () => {
      const now = new Date();
      const payload = {
        conversationId: 'conv-123',
        customerName: 'Maria',
        customerPhone: '+5511988888888',
        departmentId: 'dept-456',
        departmentName: 'Vendas',
        timestamp: now,
      };

      await service.notifyNewConversation(payload);

      const calls = mockWebsocketGateway.emitToDepartment.mock.calls;
      expect(calls[0][2].timestamp).toEqual(now);
    });
  });

  describe('notifyConversationTransferred', () => {
    it('deve emitir notificação de transferência para o novo departamento', async () => {
      const payload = {
        conversationId: 'conv-123',
        customerName: 'João Silva',
        customerPhone: '+5511999999999',
        transferredBy: 'agente-001',
        fromDepartmentId: 'dept-456',
        fromDepartmentName: 'Suporte',
        toDepartmentId: 'dept-789',
        toDepartmentName: 'Vendas',
        timestamp: new Date(),
      };

      await service.notifyConversationTransferred(payload);

      expect(mockWebsocketGateway.emitToDepartment).toHaveBeenCalledWith(
        'dept-789',
        'conversation_transferred',
        expect.objectContaining({
          conversationId: 'conv-123',
          customerName: 'João Silva',
          customerPhone: '+5511999999999',
          transferredBy: 'agente-001',
          fromDepartmentName: 'Suporte',
          toDepartmentName: 'Vendas',
        }),
      );
    });

    it('deve incluir informações de origem e destino da transferência', async () => {
      const payload = {
        conversationId: 'conv-123',
        customerName: 'Maria',
        customerPhone: '+5511988888888',
        transferredBy: 'agente-002',
        fromDepartmentId: 'dept-456',
        fromDepartmentName: 'Suporte',
        toDepartmentId: 'dept-789',
        toDepartmentName: 'Vendas',
        timestamp: new Date(),
      };

      await service.notifyConversationTransferred(payload);

      const calls = mockWebsocketGateway.emitToDepartment.mock.calls;
      const data = calls[0][2];
      expect(data.fromDepartmentName).toBe('Suporte');
      expect(data.toDepartmentName).toBe('Vendas');
      expect(data.transferredBy).toBe('agente-002');
    });
  });

  describe('notifyAudit', () => {
    it('deve emitir eventos de auditoria para a empresa', async () => {
      const companyId = 'company-123';
      const message = 'Nova conversa chegou no setor Suporte';

      await service.notifyAudit(companyId, message);

      expect(mockWebsocketGateway.emitToCompany).toHaveBeenCalledWith(
        companyId,
        'audit_event',
        expect.objectContaining({
          message: message,
        }),
      );
    });

    it('deve incluir timestamp no evento de auditoria', async () => {
      const companyId = 'company-123';
      const message = 'Conversa transferida';

      const beforeTime = new Date();
      await service.notifyAudit(companyId, message);
      const afterTime = new Date();

      const calls = mockWebsocketGateway.emitToCompany.mock.calls;
      const timestamp = calls[0][2].timestamp;
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  it('deve ter métodos de notificação', () => {
    expect(service.notifyNewConversation).toBeDefined();
    expect(service.notifyConversationTransferred).toBeDefined();
    expect(service.notifyAudit).toBeDefined();
  });
});

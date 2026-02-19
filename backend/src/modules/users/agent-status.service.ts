import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class AgentStatusService {
  private readonly logger = new Logger(AgentStatusService.name);

  constructor(
    private prisma: PrismaService,
    private moduleRef: ModuleRef,
  ) {}

  private getWebsocketGateway(): WebsocketGateway | null {
    try {
      return this.moduleRef.get(WebsocketGateway, { strict: false });
    } catch (error) {
      return null;
    }
  }

  async setStatus(userId: string, status: UserStatus) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { onlineStatus: status, lastHeartbeatAt: new Date() },
      include: { department: true },
    });
    if (user.departmentId) {
      const gateway = this.getWebsocketGateway();
      if (gateway) {
        gateway.emitToDepartment(user.departmentId, 'agent-status-changed', {
          userId,
          status,
          user: { id: user.id, name: user.name, email: user.email },
        });
      }
    }
    return user;
  }

  async getStatus(userId: string): Promise<UserStatus | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onlineStatus: true },
    });
    return user?.onlineStatus ?? null;
  }

  async heartbeat(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastHeartbeatAt: new Date() },
    });
  }

  async checkAndMarkOffline() {
    const timeoutSeconds = 120; // 2 minutes
    const cutoff = new Date(Date.now() - timeoutSeconds * 1000);
    const offline = await this.prisma.user.updateMany({
      where: {
        role: 'AGENT',
        onlineStatus: { in: ['ONLINE', 'BUSY'] },
        lastHeartbeatAt: { lt: cutoff },
      },
      data: { onlineStatus: 'OFFLINE' },
    });
    if (offline.count > 0) {
      this.logger.log(`Marked ${offline.count} agents as OFFLINE (heartbeat timeout)`);
    }
  }
}

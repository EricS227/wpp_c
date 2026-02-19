import { Injectable, Logger } from '@nestjs/common';
import { DepartmentRoutingService } from './department-routing.service';
import { AgentStatusService } from '../users/agent-status.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class DepartmentRoutingCron {
  private readonly logger = new Logger(DepartmentRoutingCron.name);

  constructor(
    private departmentRoutingService: DepartmentRoutingService,
    private agentStatusService: AgentStatusService,
  ) {}

  @Cron('*/30 * * * * *')
  handleRoutingTimeouts() {
    this.departmentRoutingService.checkTimeoutAndRedirect();
  }

  @Cron('0 * * * * *')
  handleAgentHeartbeatCheck() {
    this.agentStatusService.checkAndMarkOffline();
  }
}

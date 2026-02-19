import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AgentStatusService } from './agent-status.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [forwardRef(() => WebsocketModule)],
  controllers: [UsersController],
  providers: [UsersService, AgentStatusService],
  exports: [UsersService, AgentStatusService],
})
export class UsersModule {}

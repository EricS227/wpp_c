import { Module, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [forwardRef(() => WebsocketModule)],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

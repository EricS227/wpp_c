import { Module, forwardRef } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationRoutingService } from './conversation-routing.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    forwardRef(() => WhatsappModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationRoutingService],
  exports: [ConversationsService, ConversationRoutingService],
})
export class ConversationsModule { }

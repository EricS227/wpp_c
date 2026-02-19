import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post('send')
  send(@CurrentUser() user: any, @Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(user.id, user.companyId, dto, user.name);
  }

  @Post('send-media')
  @UseInterceptors(FileInterceptor('file'))
  async sendMedia(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('conversationId') conversationId: string,
    @Body('caption') caption?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatorio');
    if (!conversationId) throw new BadRequestException('conversationId obrigatorio');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo nao permitido. Use JPG, PNG, PDF ou DOCX.');
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('Arquivo muito grande. Limite: 10 MB.');
    }
    return this.messagesService.sendMedia(
      user.id,
      user.companyId,
      conversationId,
      file.buffer,
      file.originalname,
      user.name,
      caption,
    );
  }

  @Get('search')
  search(
    @CurrentUser() user: any,
    @Query('q') query: string,
    @Query('conversationId') conversationId?: string,
  ) {
    return this.messagesService.search(user.companyId, query, conversationId);
  }
}

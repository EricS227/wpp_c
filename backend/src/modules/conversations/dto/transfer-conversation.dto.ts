import { IsUUID, IsOptional } from 'class-validator';

export class TransferConversationDto {
  @IsUUID()
  departmentId: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

import { IsUUID, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class TransferConversationDto {
  @IsUUID()
  departmentId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  userId?: string;
}

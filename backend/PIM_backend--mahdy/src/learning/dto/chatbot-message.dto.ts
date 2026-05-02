import { ArrayMaxSize, IsArray, IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChatHistoryItemDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(1200)
  content: string;
}

export class ChatbotMessageDto {
  @IsOptional()
  @IsMongoId()
  playerId?: string;

  @IsString()
  @MaxLength(1200)
  message: string;

  @IsOptional()
  @IsIn(['practice', 'interview', 'press_conference', 'medical'])
  mode?: 'practice' | 'interview' | 'press_conference' | 'medical';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  history?: ChatHistoryItemDto[];
}

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength
} from 'class-validator';
import { MessagingConversationType } from '../enums/messaging-conversation-type.enum';
import { MessagingMessageType } from '../enums/messaging-message-type.enum';

export class ListClubUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit?: number;
}

export class ListConversationsDto {
  @IsOptional()
  @IsEnum(MessagingConversationType)
  type?: MessagingConversationType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit?: number;
}

export class ListMessagesDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit?: number;

  @IsOptional()
  @IsDateString()
  before?: string;
}

export class CreatePrivateConversationDto {
  @IsMongoId()
  targetUserId: string;
}

export class CreateGroupConversationDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  title?: string;

  @IsOptional()
  @IsMongoId()
  teamId?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  participantIds: string[];
}

export class SendMessageDto {
  @IsString()
  @Length(1, 4000)
  content: string;

  @IsOptional()
  @IsEnum(MessagingMessageType)
  type?: MessagingMessageType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class JoinConversationDto {
  @IsMongoId()
  conversationId: string;
}

export class LeaveConversationDto {
  @IsMongoId()
  conversationId: string;
}

export class TypingDto {
  @IsMongoId()
  conversationId: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isTyping?: boolean;
}

export class SocketSendMessageDto {
  @IsOptional()
  @IsMongoId()
  conversationId?: string;

  @IsOptional()
  @IsMongoId()
  recipientUserId?: string;

  @IsString()
  @Length(1, 4000)
  content: string;

  @IsOptional()
  @IsEnum(MessagingMessageType)
  type?: MessagingMessageType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

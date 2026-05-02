import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from "class-validator";
import {
  CALL_END_REASONS,
  CALL_MEDIA_TYPES,
  CALL_SESSION_TYPES,
  CallEndReason,
  CallMediaType,
  CallSessionType,
} from "../calls.types";

export class CallUserDto {
  @IsMongoId()
  conversationId: string;

  @IsEnum(CALL_MEDIA_TYPES)
  type: CallMediaType;

  @IsOptional()
  @IsEnum(CALL_SESSION_TYPES)
  sessionType?: CallSessionType;

  @IsOptional()
  @IsMongoId()
  targetUserId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sameTeamOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  ringTimeoutSeconds?: number;
}

export class AcceptCallDto {
  @IsUUID("4")
  callId: string;
}

export class RejectCallDto {
  @IsUUID("4")
  callId: string;

  @IsOptional()
  @IsEnum(CALL_END_REASONS)
  reason?: CallEndReason;
}

export class EndCallDto {
  @IsUUID("4")
  callId: string;

  @IsOptional()
  @IsEnum(CALL_END_REASONS)
  reason?: CallEndReason;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  terminateForAll?: boolean;
}

export class MuteAllParticipantsDto {
  @IsUUID("4")
  callId: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  muted?: boolean;
}

export class WebrtcOfferDto {
  @IsUUID("4")
  callId: string;

  @IsObject()
  sdp: Record<string, unknown>;
}

export class WebrtcAnswerDto {
  @IsUUID("4")
  callId: string;

  @IsObject()
  sdp: Record<string, unknown>;
}

export class IceCandidateDto {
  @IsUUID("4")
  callId: string;

  @IsObject()
  candidate: Record<string, unknown>;
}

export class RegisterPushTokenDto {
  @IsString()
  @Length(20, 4096)
  token: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}

export class RemovePushTokenDto {
  @IsString()
  @Length(20, 4096)
  token: string;
}

export class IssueCallTokenDto {
  @IsUUID("4")
  callId: string;
}

export class ListCallHistoryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit?: number;

  @IsOptional()
  @IsEnum(CALL_SESSION_TYPES)
  sessionType?: CallSessionType;

  @IsOptional()
  @IsEnum(CALL_MEDIA_TYPES)
  mediaType?: CallMediaType;
}

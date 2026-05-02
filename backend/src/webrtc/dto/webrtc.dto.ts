import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { WEBRTC_CALL_TYPES, WEBRTC_END_REASONS, WebrtcCallType, WebrtcEndReason } from '../webrtc.types';

export class CallUserDto {
  @IsMongoId()
  conversationId: string;

  @IsMongoId()
  targetUserId: string;

  @IsEnum(WEBRTC_CALL_TYPES)
  type: WebrtcCallType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sameTeamOnly?: boolean;
}

export class AcceptCallDto {
  @IsUUID('4')
  callId: string;
}

export class RejectCallDto {
  @IsUUID('4')
  callId: string;

  @IsOptional()
  @IsEnum(WEBRTC_END_REASONS)
  reason?: WebrtcEndReason;
}

export class EndCallDto {
  @IsUUID('4')
  callId: string;

  @IsOptional()
  @IsEnum(WEBRTC_END_REASONS)
  reason?: WebrtcEndReason;
}

export class WebrtcOfferDto {
  @IsUUID('4')
  callId: string;

  @IsObject()
  sdp: Record<string, unknown>;
}

export class WebrtcAnswerDto {
  @IsUUID('4')
  callId: string;

  @IsObject()
  sdp: Record<string, unknown>;
}

export class IceCandidateDto {
  @IsUUID('4')
  callId: string;

  @IsObject()
  candidate: Record<string, unknown>;
}

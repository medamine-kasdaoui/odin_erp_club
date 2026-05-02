import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import {
  CALL_END_REASONS,
  CALL_MEDIA_TYPES,
  CALL_SESSION_TYPES,
  CALL_STATUSES,
  CallEndReason,
  CallMediaType,
  CallSessionType,
  CallStatus,
} from "../calls.types";

export type CallsSessionDocument = HydratedDocument<CallsSession>;

@Schema({ collection: "calls_sessions", timestamps: true })
export class CallsSession {
  @Prop({ type: String, required: true, unique: true, index: true })
  callId: string;

  @Prop({ type: Types.ObjectId, ref: "Club", required: true, index: true })
  clubId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Team", default: null, index: true })
  teamId?: Types.ObjectId | null;

  @Prop({
    type: Types.ObjectId,
    ref: "MessagingConversation",
    required: true,
    index: true,
  })
  conversationId: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  channelId: string;

  @Prop({ type: String, enum: CALL_SESSION_TYPES, required: true, index: true })
  sessionType: CallSessionType;

  @Prop({ type: String, enum: CALL_MEDIA_TYPES, required: true })
  mediaType: CallMediaType;

  @Prop({ type: String, enum: CALL_STATUSES, required: true, index: true })
  status: CallStatus;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  callerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  hostUserId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: "User", required: true, default: [] })
  participants: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: "User", required: true, default: [] })
  invitedUserIds: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: "User", required: true, default: [] })
  acceptedUserIds: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: "User", required: true, default: [] })
  rejectedUserIds: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: "User", required: true, default: [] })
  leftUserIds: Types.ObjectId[];

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  acceptedAt?: Date | null;

  @Prop({ type: Date, default: null })
  endedAt?: Date | null;

  @Prop({ type: Date, default: null })
  timeoutAt?: Date | null;

  @Prop({ type: String, enum: CALL_END_REASONS, default: null })
  endReason?: CallEndReason | null;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export const CallsSessionSchema = SchemaFactory.createForClass(CallsSession);

CallsSessionSchema.index({ clubId: 1, status: 1, startedAt: -1 });
CallsSessionSchema.index({ clubId: 1, participants: 1, startedAt: -1 });
CallsSessionSchema.index({ conversationId: 1, startedAt: -1 });
CallsSessionSchema.index({ teamId: 1, status: 1, startedAt: -1 });

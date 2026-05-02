import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  WEBRTC_CALL_STATUSES,
  WEBRTC_CALL_TYPES,
  WEBRTC_END_REASONS,
  WebrtcCallStatus,
  WebrtcCallType,
  WebrtcEndReason
} from '../webrtc.types';

export type CallSessionDocument = HydratedDocument<CallSession>;

@Schema({ collection: 'webrtc_call_sessions', timestamps: true })
export class CallSession {
  @Prop({ type: String, required: true, unique: true, index: true })
  callId: string;

  @Prop({ type: Types.ObjectId, ref: 'Club', required: true, index: true })
  clubId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'MessagingConversation', required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  callerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  receiverId: Types.ObjectId;

  @Prop({ type: String, enum: WEBRTC_CALL_TYPES, required: true })
  type: WebrtcCallType;

  @Prop({ type: String, enum: WEBRTC_CALL_STATUSES, required: true, index: true })
  status: WebrtcCallStatus;

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  acceptedAt?: Date | null;

  @Prop({ type: Date, default: null })
  endedAt?: Date | null;

  @Prop({ type: String, enum: WEBRTC_END_REASONS, default: null })
  endReason?: WebrtcEndReason | null;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export const CallSessionSchema = SchemaFactory.createForClass(CallSession);

CallSessionSchema.index({ clubId: 1, callerId: 1, startedAt: -1 });
CallSessionSchema.index({ clubId: 1, receiverId: 1, startedAt: -1 });
CallSessionSchema.index({ conversationId: 1, startedAt: -1 });
CallSessionSchema.index({ clubId: 1, status: 1, startedAt: -1 });

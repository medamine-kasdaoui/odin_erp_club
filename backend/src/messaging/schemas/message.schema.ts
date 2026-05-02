import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessagingMessageType } from '../enums/messaging-message-type.enum';

export type MessagingMessageDocument = HydratedDocument<MessagingMessage>;

@Schema({ collection: 'messaging_messages', timestamps: true })
export class MessagingMessage {
  @Prop({ type: Types.ObjectId, ref: 'Club', required: true, index: true })
  clubId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'MessagingConversation', required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  senderId: Types.ObjectId;

  @Prop({ type: String, enum: MessagingMessageType, required: true })
  type: MessagingMessageType;

  @Prop({ type: String, required: true, maxlength: 4000 })
  content: string;

  @Prop({ type: [Types.ObjectId], default: [] })
  readBy: Types.ObjectId[];

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export const MessagingMessageSchema = SchemaFactory.createForClass(MessagingMessage);

MessagingMessageSchema.index({ conversationId: 1, createdAt: -1 });
MessagingMessageSchema.index({ clubId: 1, conversationId: 1, createdAt: -1 });
MessagingMessageSchema.index({ clubId: 1, senderId: 1, createdAt: -1 });

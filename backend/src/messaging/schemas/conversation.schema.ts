import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessagingConversationType } from '../enums/messaging-conversation-type.enum';
import { MessagingMessageType } from '../enums/messaging-message-type.enum';

export type MessagingConversationDocument = HydratedDocument<MessagingConversation>;

@Schema({ _id: false })
export class ConversationLastMessage {
  @Prop({ type: Types.ObjectId, ref: 'MessagingMessage', required: true })
  id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: String, enum: MessagingMessageType, required: true })
  type: MessagingMessageType;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: Date, required: true })
  createdAt: Date;
}

const ConversationLastMessageSchema = SchemaFactory.createForClass(ConversationLastMessage);

@Schema({ collection: 'messaging_conversations', timestamps: true })
export class MessagingConversation {
  @Prop({ type: String, enum: MessagingConversationType, required: true, index: true })
  type: MessagingConversationType;

  @Prop({ type: Types.ObjectId, ref: 'Club', required: true, index: true })
  clubId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Team', default: null, index: true })
  teamId?: Types.ObjectId | null;

  @Prop({ type: [Types.ObjectId], ref: 'User', required: true, default: [] })
  participants: Types.ObjectId[];

  @Prop({ type: String, default: null, index: true })
  participantKey?: string | null;

  @Prop({ type: String, trim: true, maxlength: 120, default: null })
  title?: string | null;

  @Prop({ type: ConversationLastMessageSchema, default: null })
  lastMessage?: ConversationLastMessage | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const MessagingConversationSchema = SchemaFactory.createForClass(MessagingConversation);

MessagingConversationSchema.index({ clubId: 1, participants: 1, updatedAt: -1 });
MessagingConversationSchema.index({ clubId: 1, type: 1, updatedAt: -1 });
MessagingConversationSchema.index({ clubId: 1, type: 1, teamId: 1, updatedAt: -1 });
MessagingConversationSchema.index(
  { clubId: 1, type: 1, participantKey: 1 },
  { unique: true, sparse: true }
);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applyIdTransform } from './erp-schema.utils';

export type ErpPlayerHistoryDocument = HydratedDocument<ErpPlayerHistory>;

export const PLAYER_HISTORY_EVENT_TYPES = [
  'status_change',
  'team_change',
  'injury',
  'suspension',
  'contract_renewal',
  'profile_update',
  'transfer'
] as const;

@Schema({ collection: 'erp_player_history', timestamps: { createdAt: true, updatedAt: false } })
export class ErpPlayerHistory {
  @Prop({ type: Types.ObjectId, ref: 'ErpPlayer', required: true, index: true })
  playerId: Types.ObjectId;

  @Prop({ type: String, enum: PLAYER_HISTORY_EVENT_TYPES, required: true })
  eventType: string;

  @Prop({ type: Date, required: true })
  eventDate: Date;

  @Prop()
  description?: string;

  @Prop({ type: Object })
  previousValue?: Record<string, unknown>;

  @Prop({ type: Object })
  newValue?: Record<string, unknown>;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const ErpPlayerHistorySchema = SchemaFactory.createForClass(ErpPlayerHistory);
applyIdTransform(ErpPlayerHistorySchema);

ErpPlayerHistorySchema.index({ playerId: 1, createdAt: -1 });

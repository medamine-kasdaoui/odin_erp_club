import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applyIdTransform } from './erp-schema.utils';

export type ErpEventDocument = HydratedDocument<ErpEvent>;

export const ERP_EVENT_TYPES = [
  'match',
  'entrainement',
  'reunion',
  'detection',
  'test_physique'
] as const;

export const ERP_EVENT_STATUS = ['planned', 'ongoing', 'completed', 'cancelled'] as const;

@Schema({ collection: 'erp_events', timestamps: true })
export class ErpEvent {
  @Prop({ type: Types.ObjectId, ref: 'Club', required: true, index: true })
  clubId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: String, enum: ERP_EVENT_TYPES, required: true })
  eventType: string;

  @Prop({ type: String, enum: ERP_EVENT_STATUS, default: 'planned' })
  status: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop()
  location?: string;

  @Prop({ type: Types.ObjectId, ref: 'ErpTeam' })
  teamId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ErpCategory' })
  categoryId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const ErpEventSchema = SchemaFactory.createForClass(ErpEvent);
applyIdTransform(ErpEventSchema);

ErpEventSchema.index({ clubId: 1, startDate: 1 });
ErpEventSchema.index({ clubId: 1, eventType: 1 });

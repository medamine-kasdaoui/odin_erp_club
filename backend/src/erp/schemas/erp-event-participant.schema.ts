import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applyIdTransform } from './erp-schema.utils';

export type ErpEventParticipantDocument = HydratedDocument<ErpEventParticipant>;

export const ERP_PARTICIPANT_STATUS = ['pending', 'confirmed', 'declined'] as const;

@Schema({ collection: 'erp_event_participants', timestamps: true })
export class ErpEventParticipant {
  @Prop({ type: Types.ObjectId, ref: 'ErpEvent', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ErpPlayer' })
  playerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ErpStaffMember' })
  staffId?: Types.ObjectId;

  @Prop()
  role?: string;

  @Prop({ type: String, enum: ERP_PARTICIPANT_STATUS, default: 'pending' })
  status: string;
}

export const ErpEventParticipantSchema =
  SchemaFactory.createForClass(ErpEventParticipant);
applyIdTransform(ErpEventParticipantSchema);

ErpEventParticipantSchema.index({ eventId: 1, playerId: 1 });

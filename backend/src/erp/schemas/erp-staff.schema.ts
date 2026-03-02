import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applyIdTransform } from './erp-schema.utils';

export type ErpStaffDocument = HydratedDocument<ErpStaffMember>;

export const STAFF_STATUS = ['active', 'inactive', 'suspended'] as const;

@Schema({ collection: 'erp_staff_members', timestamps: true })
export class ErpStaffMember {
  @Prop({ type: Types.ObjectId, ref: 'Club', required: true, index: true })
  clubId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop()
  phone?: string;

  @Prop({ trim: true })
  role?: string;

  @Prop({ trim: true })
  jobTitle?: string;

  @Prop({ type: Types.ObjectId, ref: 'ErpTeam' })
  teamId?: Types.ObjectId;

  @Prop({ type: String, enum: STAFF_STATUS, default: 'active' })
  status: string;

  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ type: Date })
  endDate?: Date;

  @Prop()
  salary?: number;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const ErpStaffSchema = SchemaFactory.createForClass(ErpStaffMember);
applyIdTransform(ErpStaffSchema);

ErpStaffSchema.virtual('team', {
  ref: 'ErpTeam',
  localField: 'teamId',
  foreignField: '_id',
  justOne: true
});

ErpStaffSchema.index({ clubId: 1, lastName: 1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StaffMemberDocument = StaffMember & Document;

@Schema({ timestamps: true, collection: 'staff' })
export class StaffMember {
  @Prop({ type: Types.ObjectId, ref: 'Club', required: false, index: true })
  clubId?: Types.ObjectId;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop()
  nationality?: string;

  @Prop()
  photoUrl?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop({ required: true, index: true })
  role: string;

  @Prop()
  specialization?: string;

  @Prop()
  licenseNumber?: string;

  @Prop({ type: Types.ObjectId, ref: 'Team', required: false, index: true })
  teamId?: Types.ObjectId;

  @Prop()
  contractStartDate?: Date;

  @Prop()
  contractEndDate?: Date;

  @Prop()
  salary?: number;

  @Prop({ default: 'active', index: true })
  status: string;

  @Prop()
  bio?: string;
}

export const StaffMemberSchema = SchemaFactory.createForClass(StaffMember);

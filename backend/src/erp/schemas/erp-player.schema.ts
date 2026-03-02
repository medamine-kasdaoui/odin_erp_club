import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applyIdTransform } from './erp-schema.utils';

export type ErpPlayerDocument = HydratedDocument<ErpPlayer>;

export const PLAYER_STATUS = ['active', 'injured', 'suspended', 'inactive'] as const;
export const PLAYER_POSITION = ['Gardien', 'Défenseur', 'Milieu', 'Attaquant'] as const;
export const PLAYER_FOOT = ['Gauche', 'Droit', 'Les deux'] as const;

@Schema({ collection: 'erp_players', timestamps: true })
export class ErpPlayer {
  @Prop({ type: Types.ObjectId, ref: 'Club', required: true, index: true })
  clubId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ type: Date, required: true })
  dateOfBirth: Date;

  @Prop({ trim: true })
  nationality?: string;

  @Prop()
  photoUrl?: string;

  @Prop({ type: String, enum: PLAYER_POSITION, required: true })
  position: string;

  @Prop({ type: String, enum: PLAYER_FOOT })
  preferredFoot?: string;

  @Prop()
  jerseyNumber?: number;

  @Prop()
  height?: number;

  @Prop()
  weight?: number;

  @Prop({ type: String, enum: PLAYER_STATUS, default: 'active' })
  status: string;

  @Prop({ type: Date })
  returnDate?: Date;

  @Prop({ type: Date })
  contractStartDate?: Date;

  @Prop({ type: Date })
  contractEndDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'ErpTeam' })
  teamId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ErpCategory' })
  categoryId?: Types.ObjectId;

  @Prop()
  aiScore?: number;

  @Prop({ type: Object })
  stats?: Record<string, unknown>;

  @Prop({ default: false })
  isProspect?: boolean;

  @Prop()
  salary?: number;

  @Prop()
  medicalNotes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const ErpPlayerSchema = SchemaFactory.createForClass(ErpPlayer);
applyIdTransform(ErpPlayerSchema);

ErpPlayerSchema.virtual('team', {
  ref: 'ErpTeam',
  localField: 'teamId',
  foreignField: '_id',
  justOne: true
});

ErpPlayerSchema.virtual('category', {
  ref: 'ErpCategory',
  localField: 'categoryId',
  foreignField: '_id',
  justOne: true
});

ErpPlayerSchema.index({ clubId: 1, lastName: 1 });
ErpPlayerSchema.index({ clubId: 1, status: 1 });
ErpPlayerSchema.index({ clubId: 1, teamId: 1 });

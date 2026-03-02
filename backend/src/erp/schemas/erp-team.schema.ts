import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applyIdTransform } from './erp-schema.utils';

export type ErpTeamDocument = HydratedDocument<ErpTeam>;

@Schema({ collection: 'erp_teams', timestamps: true })
export class ErpTeam {
  @Prop({ type: Types.ObjectId, ref: 'Club', required: true, index: true })
  clubId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'ErpCategory' })
  categoryId?: Types.ObjectId;

  @Prop()
  coachName?: string;

  @Prop()
  description?: string;

  @Prop({ default: true })
  isActive?: boolean;
}

export const ErpTeamSchema = SchemaFactory.createForClass(ErpTeam);
applyIdTransform(ErpTeamSchema);

ErpTeamSchema.virtual('category', {
  ref: 'ErpCategory',
  localField: 'categoryId',
  foreignField: '_id',
  justOne: true
});

ErpTeamSchema.index({ clubId: 1, name: 1 });

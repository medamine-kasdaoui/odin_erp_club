import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applyIdTransform } from './erp-schema.utils';

export type ErpReadinessResultDocument = HydratedDocument<ErpReadinessResult>;

@Schema({
  collection: 'erp_readiness_results',
  timestamps: { createdAt: 'analyzedAt', updatedAt: false }
})
export class ErpReadinessResult {
  @Prop({ required: true })
  playerId: string;

  @Prop({ required: true, trim: true })
  playerName: string;

  @Prop({ type: Types.ObjectId, ref: 'Club', required: true, index: true })
  clubId: Types.ObjectId;

  @Prop({ required: true, index: true })
  matchDate: string;

  @Prop({ required: true, min: 0, max: 100 })
  score: number;

  @Prop({ required: true })
  status: string;

  @Prop({ default: false })
  titulaire: boolean;

  @Prop({ type: [Object], default: [] })
  factors: Record<string, unknown>[];

  @Prop()
  analysis?: string;

  @Prop()
  recommendation?: string;

  @Prop({ default: false })
  usedAi: boolean;

  @Prop()
  analyzedAt: Date;
}

export const ErpReadinessResultSchema =
  SchemaFactory.createForClass(ErpReadinessResult);
applyIdTransform(ErpReadinessResultSchema);

ErpReadinessResultSchema.index({ clubId: 1, matchDate: 1 });
ErpReadinessResultSchema.index({ playerId: 1, matchDate: 1, clubId: 1 });
ErpReadinessResultSchema.index({ analyzedAt: -1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GamificationBadgeDocument = GamificationBadge & Document;

@Schema({ timestamps: true })
export class GamificationBadge {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  badgeId: string; // ex: 'first_elite_test', 'perfect_nutrition_7d'

  @Prop({ required: true })
  unlockedAt: Date;
}

export const GamificationBadgeSchema = SchemaFactory.createForClass(GamificationBadge);

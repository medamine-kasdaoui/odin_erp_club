import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GamificationProfileDocument = GamificationProfile & Document;

@Schema({ timestamps: true })
export class GamificationProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  totalPoints: number;

  @Prop({ required: true, default: 0 })
  monthlyPoints: number;

  @Prop({ required: true, default: 'Recrue' })
  currentLevel: string;

  @Prop({ required: true, default: 0 })
  activeStreak: number;

  @Prop({ type: Date })
  lastActionDate: Date;
}

export const GamificationProfileSchema = SchemaFactory.createForClass(GamificationProfile);

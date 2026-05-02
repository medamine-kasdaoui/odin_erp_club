import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GamificationActionDocument = GamificationAction & Document;

@Schema({ timestamps: true })
export class GamificationAction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  actionType: string;

  @Prop({ required: true })
  points: number;

  @Prop()
  description: string;

  @Prop({ required: true })
  moduleId: string; // ex: 'travel', 'cognitive', 'nutrition'
}

export const GamificationActionSchema = SchemaFactory.createForClass(GamificationAction);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TestDocument = Test & Document;

@Schema({ timestamps: true, collection: 'test' })
export class Test {
  @Prop({ type: Types.ObjectId, ref: 'Player', required: true, index: true })
  playerId: Types.ObjectId;

  @Prop({ required: true })
  currentValue: number;

  @Prop({ required: true })
  predictedValue: number;

  @Prop({ required: true })
  nextSeasonValue: number;

  @Prop({ required: true })
  confidenceScore: number;

  @Prop({ type: [String], default: [] })
  keyFactors: string[];

  @Prop({ required: true })
  explanation: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;
}

export const TestSchema = SchemaFactory.createForClass(Test);

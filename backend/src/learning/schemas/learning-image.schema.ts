import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LearningImageDocument = LearningImage & Document;

@Schema({ timestamps: true, collection: 'learning_images' })
export class LearningImage {
  @Prop({ required: true, unique: true, index: true })
  externalId: string;

  @Prop({ required: true, index: true })
  pageNumber: number;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  sourcePdf?: string;

  @Prop()
  purpose?: string;
}

export const LearningImageSchema = SchemaFactory.createForClass(LearningImage);
LearningImageSchema.index({ pageNumber: 1, type: 1 });

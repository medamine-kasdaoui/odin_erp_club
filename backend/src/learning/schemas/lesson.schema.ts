import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Course } from './course.schema';

export type LessonDocument = Lesson & Document;

@Schema({ _id: false })
export class TranscriptSegment {
  @Prop({ required: true })
  time: string;

  @Prop({ required: true })
  text: string;

  @Prop({ default: false })
  current: boolean;
}

const TranscriptSegmentSchema = SchemaFactory.createForClass(TranscriptSegment);

@Schema({ timestamps: true, collection: 'learning_lessons' })
export class Lesson {
  @Prop({ type: Types.ObjectId, ref: Course.name, required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop()
  videoUrl?: string;

  @Prop({ required: true, default: 1 })
  order: number;

  @Prop({ default: 12 })
  durationMinutes: number;

  @Prop({ default: 'Module' })
  moduleLabel: string;

  @Prop({ default: 70, min: 0, max: 100 })
  focusScore: number;

  @Prop({ type: [TranscriptSegmentSchema], default: [] })
  transcript: TranscriptSegment[];

  @Prop({ type: [String], default: [] })
  vocabulary: string[];

  @Prop({ default: false })
  injuryCommunication: boolean;

  @Prop({ index: true })
  externalId?: string;

  @Prop()
  pageStart?: number;

  @Prop()
  pageEnd?: number;

  @Prop({ type: [String], default: [] })
  exerciseIds: string[];

  @Prop({ type: [String], default: [] })
  sourcePageImages: string[];

  @Prop()
  sourcePdf?: string;

  @Prop()
  contentMode?: string;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);
LessonSchema.index({ courseId: 1, order: 1 });

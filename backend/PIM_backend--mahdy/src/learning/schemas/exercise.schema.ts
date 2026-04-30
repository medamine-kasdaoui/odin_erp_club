import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Lesson } from './lesson.schema';

export type LearningExerciseDocument = LearningExercise & Document;

@Schema({ timestamps: true, collection: 'learning_exercises' })
export class LearningExercise {
  @Prop({ required: true, unique: true, index: true })
  externalId: string;

  @Prop({ type: Types.ObjectId, ref: Lesson.name, required: true, index: true })
  lessonObjectId: Types.ObjectId;

  @Prop({ required: true, index: true })
  datasetLessonId: string;

  @Prop()
  lessonTitle?: string;

  @Prop({ required: true, index: true })
  type: string;

  @Prop()
  title?: string;

  @Prop()
  prompt?: string;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  questions: any[];

  @Prop({ type: [String], default: [] })
  options: string[];

  @Prop({ type: MongooseSchema.Types.Mixed })
  answerKey?: any;

  @Prop({ type: MongooseSchema.Types.Mixed })
  grading?: any;

  @Prop()
  difficulty?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  assets: any[];

  @Prop()
  sourcePageImage?: string;

  @Prop()
  page?: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const LearningExerciseSchema = SchemaFactory.createForClass(LearningExercise);
LearningExerciseSchema.index({ lessonObjectId: 1, page: 1, externalId: 1 });

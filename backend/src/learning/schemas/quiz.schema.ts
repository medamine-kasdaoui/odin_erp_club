import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Lesson } from './lesson.schema';

export type QuizDocument = Quiz & Document;

@Schema({ timestamps: true, collection: 'learning_quizzes' })
export class Quiz {
  @Prop({ type: Types.ObjectId, ref: Lesson.name, required: true, index: true })
  lessonId: Types.ObjectId;

  @Prop({ required: true })
  question: string;

  @Prop({ type: [String], required: true })
  options: string[];

  @Prop({ required: true })
  correctAnswer: string;

  @Prop()
  explanation?: string;

  @Prop({ default: 1 })
  order: number;
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);
QuizSchema.index({ lessonId: 1, order: 1 });

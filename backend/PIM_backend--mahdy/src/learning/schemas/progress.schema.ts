import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Player } from '../../players/schemas/player.schema';
import { Course } from './course.schema';
import { Lesson } from './lesson.schema';

export type ProgressDocument = Progress & Document;

@Schema({ timestamps: true, collection: 'learning_progress' })
export class Progress {
  @Prop({ type: Types.ObjectId, ref: Player.name, required: true, index: true })
  playerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Course.name, required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ default: 0, min: 0, max: 100 })
  progressPercentage: number;

  @Prop({ default: false, index: true })
  completed: boolean;

  @Prop({ type: [Types.ObjectId], ref: Lesson.name, default: [] })
  completedLessons: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: Lesson.name })
  lastLessonId?: Types.ObjectId;

  @Prop()
  earnedBadge?: string;
}

export const ProgressSchema = SchemaFactory.createForClass(Progress);
ProgressSchema.index({ playerId: 1, courseId: 1 }, { unique: true });

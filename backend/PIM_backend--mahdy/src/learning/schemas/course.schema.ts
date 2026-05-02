import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CourseDocument = Course & Document;

export enum CourseLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  ELITE = 'ELITE',
}

export enum CourseType {
  COMMUNICATION = 'COMMUNICATION',
  MEDICAL = 'MEDICAL',
  TACTICAL = 'TACTICAL',
  FOUNDATION = 'FOUNDATION',
  MEDIA = 'MEDIA',
}

@Schema({ timestamps: true, collection: 'learning_courses' })
export class Course {
  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: CourseLevel })
  level: CourseLevel;

  @Prop({ required: true, enum: CourseType, index: true })
  type: CourseType;

  @Prop({ type: [String], default: ['ALL'], index: true })
  recommendedPositions: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: 0 })
  estimatedMinutes: number;

  @Prop()
  thumbnailUrl?: string;

  @Prop()
  badgeName?: string;

  @Prop({ default: false, index: true })
  medicalFocus: boolean;

  @Prop({ default: 1 })
  order: number;

  @Prop()
  sourcePdf?: string;

  @Prop()
  datasetVersion?: string;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
CourseSchema.index({ type: 1, level: 1 });

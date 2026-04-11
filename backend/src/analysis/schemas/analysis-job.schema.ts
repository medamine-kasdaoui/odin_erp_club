import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  AnalysisJobErrorSummary,
  AnalysisJobProgress,
  AnalysisJobRequestSnapshot,
  AnalysisJobStatus
} from '../interfaces/analysis-job.interface';

export type AnalysisJobDocument = AnalysisJob & Document;

@Schema({ collection: 'analysis_jobs' })
export class AnalysisJob {
  @Prop({ required: true, unique: true, index: true })
  jobId: string;

  @Prop({ required: true })
  status: AnalysisJobStatus;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  finishedAt?: Date;

  @Prop({ required: true })
  outputJsonPath: string;

  @Prop({ default: false })
  resultAvailable: boolean;

  @Prop({ type: Object, required: true })
  request: AnalysisJobRequestSnapshot;

  @Prop({ type: Object, required: true })
  progress: AnalysisJobProgress;

  @Prop()
  lastProgressAt?: Date;

  @Prop()
  pid?: number;

  @Prop({ type: Object, default: null })
  cliSummary?: Record<string, unknown>;

  @Prop({ type: Object, default: null })
  error?: AnalysisJobErrorSummary;

  @Prop({
    type: {
      stdoutTail: { type: [String], default: [] },
      stderrTail: { type: [String], default: [] }
    },
    default: { stdoutTail: [], stderrTail: [] }
  })
  logs: {
    stdoutTail: string[];
    stderrTail: string[];
  };
}

export const AnalysisJobSchema = SchemaFactory.createForClass(AnalysisJob);

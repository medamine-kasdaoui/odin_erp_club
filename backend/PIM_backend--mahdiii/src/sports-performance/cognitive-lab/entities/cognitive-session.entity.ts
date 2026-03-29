import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CognitiveSessionDocument = CognitiveSession & Document;

@Schema({ _id: false })
export class ReactionMetrics {
    @Prop({ type: Number, required: true }) avgMs: number;
    @Prop({ type: Number, required: true }) bestMs: number;
    @Prop({ type: Number, required: true }) worstMs: number;
    @Prop({ type: Number, required: true }) accuracy: number;
}

@Schema({ _id: false })
export class FocusMetrics {
    @Prop({ type: Number, required: true }) completionTime: number;
    @Prop({ type: Number, required: true }) errors: number;
}

@Schema({ _id: false })
export class MemoryMetrics {
    @Prop({ type: Number, required: true }) correctSequences: number;
    @Prop({ type: Number, required: true }) failures: number;
    @Prop({ type: Number, required: true }) maxLevel: number;
}

@Schema({ _id: false })
export class DecisionMetrics {
    @Prop({ type: Number }) avgDecisionTime: number;   // ms per question
    @Prop({ type: Number }) correctAnswers: number;
    @Prop({ type: Number }) wrongAnswers: number;
    @Prop({ type: Number }) hesitationCount: number;   // answered after 3s
    @Prop({ type: Number }) accuracy: number;          // 0-100
}

@Schema({ _id: false })
export class WellnessMetrics {
    @Prop() sleepQuality?: string;      // Very Good / Good / Normal / Poor / Very Poor
    @Prop() sleepHours?: number;
    @Prop() muscleSoreness?: string;    // None / Light / Moderate / Heavy
    @Prop() stressLevel?: string;       // Low / Moderate / High
    @Prop() energyLevel?: string;       // High / Normal / Low
    @Prop() mood?: string;              // Excellent / Good / Normal / Bad
    @Prop() motivation?: string;        // High / Normal / Low
    @Prop() generalPain?: number;       // 0-10 scale (FIFA standard)
}

@Schema({ _id: false })
class CognitiveScores {
    @Prop({ type: Number, required: true }) reactionScore: number;
    @Prop({ type: Number, required: true }) focusScore: number;
    @Prop({ type: Number, required: true }) memoryScore: number;
    @Prop({ type: Number, required: true }) mentalScore: number;
    @Prop({ type: Number }) decisionScore?: number;
    @Prop({ type: Number }) wellnessScore?: number;
    @Prop({ type: String }) trainingReadiness?: string;
}

@Schema({ timestamps: true })
export class CognitiveSession {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    playerId: Types.ObjectId;

    @Prop({ default: Date.now })
    date: Date;

    // Raw Test Data (Core)
    @Prop({ type: ReactionMetrics, required: true }) reaction: ReactionMetrics;
    @Prop({ type: FocusMetrics, required: true }) focus: FocusMetrics;
    @Prop({ type: MemoryMetrics, required: true }) memory: MemoryMetrics;

    // Raw Test Data (Extended — optional)
    @Prop({ type: DecisionMetrics }) decision?: DecisionMetrics;
    @Prop({ type: WellnessMetrics }) wellness?: WellnessMetrics;

    // Calculated Scores
    @Prop({ type: CognitiveScores, required: true }) scores: CognitiveScores;

    // AI Output
    @Prop({ required: true }) aiStatus: string;
    @Prop({ required: true }) riskLevel: string;
    @Prop({ required: true }) aiRecommendationText: string;
    @Prop({ required: true }) trainingSuggestion: string;
}

export const CognitiveSessionSchema = SchemaFactory.createForClass(CognitiveSession);

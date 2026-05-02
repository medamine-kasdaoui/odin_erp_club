import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { Club } from '../../clubs/schemas/club.schema';
import { Team } from '../../teams/schemas/team.schema';
import { User } from '../../users/schemas/user.schema';
import { Category } from '../../categories/schemas/category.schema';

export enum EventType {
    MATCH         = 'match',
    DETECTION     = 'detection',
    PHYSICAL_TEST = 'test_physique',
    TRAINING      = 'entrainement',
    MEETING       = 'reunion',
    OTHER         = 'autre',
}

export enum EventStatus {
    SCHEDULED = 'scheduled',
    ONGOING   = 'ongoing',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

export enum EventVisibility {
    CLUB   = 'club',
    TEAM   = 'team',
    STAFF  = 'staff',
    PUBLIC = 'public',
}

// ─── Sub-documents ────────────────────────────────────────────────────────────

export class MatchLineupEntry {
    playerId: string;
    playerName: string;
    position: string;      // 'GK', 'CB', 'LB', 'CM', 'ST' …
    jerseyNumber: number;
    isStarter: boolean;
}

export class ScoreEvent {
    playerId: string;
    playerName: string;
    minute: number;
    isOwnGoal: boolean;
}

export class AssistEvent {
    playerId: string;
    playerName: string;
    minute: number;
}

export class CardEvent {
    playerId: string;
    playerName: string;
    minute: number;
    cardType: 'yellow' | 'red';
}

export class SubstitutionEvent {
    playerOutId: string;
    playerOutName: string;
    playerInId: string;
    playerInName: string;
    minute: number;
}

export class MatchSheet {
    starters: MatchLineupEntry[];
    subs: MatchLineupEntry[];
    formation: string;
    validatedAt?: Date;
    validatedBy?: string;
}

export class WeatherInfo {
    condition: string;   // 'clear', 'rain', 'clouds', 'thunderstorm' …
    tempCelsius: number;
    windKmh: number;
    icon: string;
    fetchedAt: Date;
}

export class RecurrenceRule {
    freq: 'weekly' | 'biweekly';
    daysOfWeek: number[];   // 0 = dimanche, 1 = lundi …
    endDate: Date;
    parentEventId?: string;
}

export class MatchStats {
    fouls: number;
}

export class LogisticsInfo {
    @Prop({ type: Number, default: null })
    travelTimeSeconds: number;

    @Prop({ type: Date, default: null })
    departureTime: Date;

    @Prop({ type: Number, default: null })
    distanceKm: number;

    @Prop({ type: String, default: null })
    itineraryUrl: string;

    @Prop({ type: String, default: null })
    startAddress: string;

    @Prop({ type: String, default: null })
    polyline: string;

    @Prop({ type: Number, default: null })
    lat: number;

    @Prop({ type: Number, default: null })
    lon: number;

    @Prop({ type: Date, default: null })
    calculatedAt: Date;
}

// ─── Main schema ──────────────────────────────────────────────────────────────

export type ErpEventDocument = ErpEvent & Document;

@Schema({ 
    collection: 'erp_events',
    timestamps: true, 
    toJSON: { virtuals: true }, 
    toObject: { virtuals: true } 
})
export class ErpEvent {
    id?: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true })
    clubId: mongoose.Types.ObjectId;

    club?: Club;

    @Prop({ type: String, enum: EventType, required: true })
    eventType: EventType;

    @Prop({ required: true, maxlength: 200 })
    title: string;

    @Prop({ type: String, default: null })
    matchResultNotes: string;

    @Prop({ type: Number, default: 90 }) // 90, 105, 120
    matchDuration: number;

    @Prop({ type: Object, default: null })
    aiDebrief: any;

    @Prop({ type: Object, default: null }) // Summary stats (totals)
    matchSummary: any;

    @Prop({ type: String, default: null })
    opponentName: string;

    @Prop({ type: Boolean, default: true })
    isHome: boolean;

    @Prop({ type: String, default: null })
    description: string;

    @Prop({ type: Date, required: true })
    startDate: Date;

    @Prop({ type: Date, required: true })
    endDate: Date;

    @Prop({ type: Boolean, default: false })
    allDay: boolean;

    @Prop({ type: String, maxlength: 255, default: null })
    location: string;

    @Prop({ type: Object, default: null })
    eventDetails: Record<string, any>;

    @Prop({ type: String, enum: EventStatus, default: EventStatus.SCHEDULED })
    status: EventStatus;

    // ─── Score & résultat ─────────────────────────────────────────────────────
    @Prop({ type: Number, default: null })
    homeScore: number;

    @Prop({ type: Number, default: null })
    awayScore: number;

    // ─── Feuille de match ─────────────────────────────────────────────────────
    @Prop({ type: String, default: null })
    formation: string;

    @Prop({ type: Object, default: null })
    matchSheet: MatchSheet;

    @Prop({ type: Object, default: null })
    stats: MatchStats;

    // ─── Stats post-match ─────────────────────────────────────────────────────
    @Prop({ type: Array, default: [] })
    scorers: ScoreEvent[];

    @Prop({ type: Array, default: [] })
    assists: AssistEvent[];

    @Prop({ type: Array, default: [] })
    cards: CardEvent[];

    @Prop({ type: Array, default: [] })
    substitutions: SubstitutionEvent[];

    // ─── Météo ────────────────────────────────────────────────────────────────
    @Prop({ type: Object, default: null })
    weather: WeatherInfo;

    // ─── Récurrence ───────────────────────────────────────────────────────────
    @Prop({ type: Object, default: null })
    recurrenceRule: RecurrenceRule;

    // ─── Visibilité & équipe ──────────────────────────────────────────────────
    @Prop({ type: String, enum: EventVisibility, default: EventVisibility.CLUB })
    visibility: EventVisibility;

    @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
    teamId: mongoose.Types.ObjectId;

    team?: Team;

    // ─── Rappels ──────────────────────────────────────────────────────────────
    @Prop({ type: Boolean, default: true })
    reminderEnabled: boolean;

    @Prop({ type: Number, default: 60 })
    reminderMinutes: number;

    /** Indique si le rappel J-1 a déjà été envoyé (évite les doublons cron) */
    @Prop({ type: Boolean, default: false })
    reminderDayBeforeSent: boolean;

    /** Indique si le rappel 2h avant a déjà été envoyé */
    @Prop({ type: Boolean, default: false })
    reminderTwoHourSent: boolean;

    // ─── Logistique Déplacement ───────────────────────────────────────────────
    @Prop({ type: Object, default: null })
    logistics: LogisticsInfo;

    // ─── Créateur ─────────────────────────────────────────────────────────────
    @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
    createdBy: mongoose.Types.ObjectId;

    creator?: User;
}

export const ErpEventSchema = SchemaFactory.createForClass(ErpEvent);

ErpEventSchema.virtual('club', {
    ref: 'Club',
    localField: 'clubId',
    foreignField: '_id',
    justOne: true,
});

ErpEventSchema.virtual('team', {
    ref: 'Team',
    localField: 'teamId',
    foreignField: '_id',
    justOne: true,
});

ErpEventSchema.virtual('category', {
    ref: 'Category',
    localField: 'categoryId',
    foreignField: '_id',
    justOne: true,
});

ErpEventSchema.virtual('creator', {
    ref: 'User',
    localField: 'createdBy',
    foreignField: '_id',
    justOne: true,
});

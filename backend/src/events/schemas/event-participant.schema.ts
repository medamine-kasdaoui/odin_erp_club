import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { ErpEvent } from './event.schema';
import { Player } from '../../players/schemas/player.schema';

export enum ParticipantType {
    PLAYER = 'player',
    STAFF  = 'staff',
}

export enum ParticipationStatus {
    INVITED   = 'invited',
    CONFIRMED = 'confirmed',
    DECLINED  = 'declined',
    ABSENT    = 'absent',
    PRESENT   = 'present',
}

export class ConvocationDetails {
    meetingTime: string;     // ex: '09:00' — heure de RDV (peut précéder le match)
    requiredKit: string;     // ex: 'Maillot domicile blanc'
    instructions: string;   // notes supplémentaires pour le joueur
}

export type ErpEventParticipantDocument = ErpEventParticipant & Document;

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class ErpEventParticipant {
    id?: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true, ref: 'ErpEvent' })
    eventId: mongoose.Types.ObjectId;

    event?: ErpEvent;

    @Prop({ type: String, enum: ParticipantType, required: true })
    participantType: ParticipantType;

    @Prop({ type: String, required: true })
    participantId: string;

    /** Nom complet du participant (dénormalisé pour éviter les joins) */
    @Prop({ type: String, default: null })
    participantName: string;

    @Prop({ type: String, enum: ParticipationStatus, default: ParticipationStatus.INVITED })
    status: ParticipationStatus;

    @Prop({ type: Date, default: null })
    responseDate: Date;

    @Prop({ type: String, default: null })
    notes: string;

    @Prop({ type: Number, default: null })
    performanceRating: number;

    // ─── Rôle dans la feuille de match ──────────────────────────────────────
    @Prop({ type: Boolean, default: false })
    isStarter: boolean;

    @Prop({ type: String, default: null })
    position: string;   // 'GK', 'CB', 'LB', 'CM', 'ST' …

    @Prop({ type: Number, default: null })
    jerseyNumber: number;

    // ─── Post-Match Performance Stats ──────────────────────────────────────
    @Prop({ type: Boolean, default: false })
    played: boolean;

    @Prop({ type: Number, default: 0 })
    goals: number;

    @Prop({ type: Number, default: 0 })
    assists: number;

    @Prop({ type: Number, default: 0 })
    minutesPlayed: number;

    @Prop({ type: Number, default: null })
    minuteIn: number;

    @Prop({ type: Number, default: null })
    minuteOut: number;

    @Prop({ type: Number, default: 0 })
    shotsOnTarget: number;

    @Prop({ type: Number, default: 0 })
    keyPasses: number;

    @Prop({ type: Number, default: 0 })
    tackles: number;

    @Prop({ type: Number, default: 0 })
    interceptions: number;

    @Prop({ type: Number, default: 0 })
    clearances: number;

    // GK Specific
    @Prop({ type: Number, default: 0 })
    saves: number;

    @Prop({ type: Number, default: 0 })
    goalsConceded: number;

    @Prop({ type: Number, default: 0 })
    penaltiesSaved: number;

    // Discipline
    @Prop({ type: Boolean, default: false })
    yellowCard: boolean;

    @Prop({ type: Boolean, default: false })
    redCard: boolean;

    @Prop({ type: Number, default: null })
    cardMinute: number;

    // Physical
    @Prop({ type: Number, default: 0 })
    distanceCovered: number;

    @Prop({ type: Number, default: 0 })
    topSpeed: number;

    @Prop({ type: Number, default: 0 })
    sprints: number;

    // Evaluation
    @Prop({ type: Number, default: null }) // 1.0 - 10.0 rating
    rating: number;

    @Prop({ type: String, default: null })
    privateNote: string; // Coach only

    @Prop({ type: String, default: null })
    publicNote: string; // Visible to player

    @Prop({ type: Boolean, default: false })
    notificationSent: boolean;

    // ─── Convocation ────────────────────────────────────────────────────────
    @Prop({ type: Date, default: null })
    convocationSentAt: Date;

    @Prop({ type: Object, default: null })
    convocationDetails: ConvocationDetails;
}

export const ErpEventParticipantSchema = SchemaFactory.createForClass(ErpEventParticipant);

ErpEventParticipantSchema.index(
    { eventId: 1, participantType: 1, participantId: 1 },
    { unique: true },
);

ErpEventParticipantSchema.virtual('event', {
    ref: 'ErpEvent',
    localField: 'eventId',
    foreignField: '_id',
    justOne: true,
});

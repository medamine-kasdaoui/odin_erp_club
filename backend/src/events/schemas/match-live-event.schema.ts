import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';

export enum LiveEventType {
    GOAL         = 'goal',
    OWN_GOAL     = 'own_goal',
    YELLOW_CARD  = 'yellow_card',
    RED_CARD     = 'red_card',
    SUBSTITUTION = 'substitution',
    INJURY       = 'injury',
    VAR          = 'var',
    KICKOFF      = 'kickoff',
    HALFTIME     = 'halftime',
    FULLTIME     = 'fulltime',
    PENALTY      = 'penalty',
    CUSTOM       = 'custom',
}

export type MatchLiveEventDocument = MatchLiveEvent & Document;

@Schema({ timestamps: true })
export class MatchLiveEvent {
    id?: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true, ref: 'ErpEvent' })
    eventId: mongoose.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true })
    clubId: mongoose.Types.ObjectId;

    @Prop({ type: String, enum: LiveEventType, required: true })
    type: LiveEventType;

    /** Minute dans le match (0–120) */
    @Prop({ type: Number, required: true, min: 0, max: 120 })
    minute: number;

    /** ID du joueur principal (buteur, cartonné, sortant...) */
    @Prop({ type: String, default: null })
    playerId: string;

    /** Nom affiché (sans avoir à populer) */
    @Prop({ type: String, default: null })
    playerName: string;

    /** Pour les remplacements : le joueur qui entre */
    @Prop({ type: String, default: null })
    playerInId: string;

    @Prop({ type: String, default: null })
    playerInName: string;

    /** Pour les passes décisives */
    @Prop({ type: String, default: null })
    assistPlayerId: string;

    @Prop({ type: String, default: null })
    assistPlayerName: string;

    /** Description libre */
    @Prop({ type: String, default: null })
    description: string;

    /** Qui a saisi cet événement */
    @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
    createdBy: mongoose.Types.ObjectId;
}

export const MatchLiveEventSchema = SchemaFactory.createForClass(MatchLiveEvent);
MatchLiveEventSchema.index({ eventId: 1, minute: 1 });

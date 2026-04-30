import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { Club } from '../../clubs/schemas/club.schema';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class Category {
    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true })
    clubId: mongoose.Types.ObjectId;

    // Virtual 'club' is defined below the schema
    club?: Club;

    @Prop({ required: true, maxlength: 50 })
    name: string; // U15, U17, U19, Seniors, etc.

    @Prop({ type: Number, default: null })
    ageMin: number;

    @Prop({ type: Number, default: null })
    ageMax: number;

    @Prop({ type: String, default: null })
    description: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.virtual('club', {
    ref: 'Club',
    localField: 'clubId',
    foreignField: '_id',
    justOne: true
});

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { Club } from '../../clubs/schemas/club.schema';
import { Category } from '../../categories/schemas/category.schema';

export type TeamDocument = Team & Document;

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class Team {
    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true })
    clubId: mongoose.Types.ObjectId;

    // Virtual 'club' is defined below the schema
    club?: Club;

    @Prop({ required: true, maxlength: 100 })
    name: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
    categoryId: mongoose.Types.ObjectId;

    // Virtual 'category' is defined below the schema
    category?: Category;

    @Prop({ type: String, default: null })
    description: string;
}

export const TeamSchema = SchemaFactory.createForClass(Team);

TeamSchema.virtual('club', {
    ref: 'Club',
    localField: 'clubId',
    foreignField: '_id',
    justOne: true
});

TeamSchema.virtual('category', {
    ref: 'Category',
    localField: 'categoryId',
    foreignField: '_id',
    justOne: true
});

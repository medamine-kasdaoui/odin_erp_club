import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applyIdTransform } from './erp-schema.utils';

export type ErpCategoryDocument = HydratedDocument<ErpCategory>;

@Schema({ collection: 'erp_categories', timestamps: true })
export class ErpCategory {
  @Prop({ type: Types.ObjectId, ref: 'Club', required: true, index: true })
  clubId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  code?: string;

  @Prop()
  description?: string;

  @Prop({ default: true })
  isActive?: boolean;
}

export const ErpCategorySchema = SchemaFactory.createForClass(ErpCategory);
applyIdTransform(ErpCategorySchema);
ErpCategorySchema.index({ clubId: 1, name: 1 }, { unique: true });

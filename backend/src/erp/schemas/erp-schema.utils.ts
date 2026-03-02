import { Schema } from 'mongoose';

export const applyIdTransform = (schema: Schema) => {
  const transform = (_: unknown, ret: Record<string, unknown>) => {
    if (ret._id) {
      ret.id = String(ret._id);
      delete ret._id;
    }
    delete ret.__v;
    return ret;
  };

  schema.set('toJSON', { virtuals: true, transform });
  schema.set('toObject', { virtuals: true, transform });
};

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TravelDocument = Travel & Document;

@Schema({ timestamps: true })
export class Travel {
  @Prop({ required: true, index: true })
  clubId: string;

  @Prop({ type: Types.ObjectId, ref: 'Match', required: false })
  matchId: Types.ObjectId;

  @Prop({ required: true })
  destination: string;

  @Prop()
  destinationLat?: number;

  @Prop()
  destinationLng?: number;

  @Prop({ enum: ['away', 'home', 'tour'], default: 'away' })
  type: string;

  @Prop({
    type: {
      at: Date,
      from: String,
      fromLat: Number,
      fromLng: Number,
      mode: { type: String, enum: ['bus', 'flight', 'train', 'car'] },
      flightNumber: String,
      terminal: String,
      gate: String,
    },
    required: true,
  })
  departure: {
    at: Date;
    from: string;
    fromLat?: number;
    fromLng?: number;
    mode: string;
    flightNumber?: string;
    terminal?: string;
    gate?: string;
  };

  @Prop({
    type: {
      at: Date,
      from: String,
      flightNumber: String,
    },
  })
  return: {
    at: Date;
    from?: string;
    flightNumber?: string;
  };

  @Prop({
    type: {
      name: String,
      address: String,
      phone: String,
      website: String,
      lat: Number,
      lng: Number,
      checkIn: Date,
      checkOut: Date,
      rooms: [
        {
          roomNumber: String,
          type: { type: String, enum: ['single', 'double', 'suite'] },
          occupant1: { type: Types.ObjectId, ref: 'Player' },
          occupant2: { type: Types.ObjectId, ref: 'Player' },
          isStaffRoom: Boolean,
        },
      ],
    },
  })
  hotel: {
    name: string;
    address: string;
    phone?: string;
    website?: string;
    lat?: number;
    lng?: number;
    checkIn: Date;
    checkOut: Date;
    rooms: Array<{
      roomNumber: string;
      type: string;
      occupant1?: Types.ObjectId;
      occupant2?: Types.ObjectId;
      isStaffRoom?: boolean;
    }>;
  };

  @Prop({
    type: {
      players: [{ type: Types.ObjectId, ref: 'Player' }],
      staff: [{ type: Types.ObjectId, ref: 'User' }],
    },
  })
  participants: {
    players: Types.ObjectId[];
    staff: Types.ObjectId[];
  };

  @Prop({
    type: {
      code: String,
      name: String,
      terminal: String,
      parkingArea: String,
      meetingPoint: String,
      lat: Number,
      lng: Number,
    },
  })
  departureAirport?: {
    code: string;
    name: string;
    terminal?: string;
    parkingArea?: string;
    meetingPoint?: string;
    lat?: number;
    lng?: number;
  };

  @Prop({
    type: {
      code: String,
      name: String,
      lat: Number,
      lng: Number,
    },
  })
  arrivalAirport?: {
    code: string;
    name: string;
    lat?: number;
    lng?: number;
  };

  @Prop()
  budgetEstime?: number;

  @Prop({ enum: ['planned', 'active', 'completed', 'cancelled'], default: 'planned' })
  status: string;

  @Prop()
  notes?: string;
}

export const TravelSchema = SchemaFactory.createForClass(Travel);

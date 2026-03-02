import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ErpEvent, ErpEventDocument } from './schemas/erp-event.schema';
import { ErpEventParticipant, ErpEventParticipantDocument } from './schemas/erp-event-participant.schema';

export interface ErpEventsFilter {
  eventType?: string;
  teamId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ErpEventsService {
  constructor(
    @InjectModel(ErpEvent.name)
    private readonly eventModel: Model<ErpEventDocument>,
    @InjectModel(ErpEventParticipant.name)
    private readonly participantModel: Model<ErpEventParticipantDocument>
  ) {}

  private toObjectId(value?: string) {
    if (!value) return undefined;
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }

  private parseDate(value?: string) {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return parsed;
  }

  async findAll(clubId: Types.ObjectId, filters: ErpEventsFilter = {}) {
    const { eventType, teamId, status, startDate, endDate, page = 1, limit = 50 } = filters;
    const query: Record<string, unknown> = { clubId };

    if (eventType) query.eventType = eventType;
    if (teamId) query.teamId = this.toObjectId(teamId);
    if (status) query.status = status;

    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);

    if (start) {
      query.startDate = { ...(query.startDate as Record<string, unknown>), $gte: start };
    }
    if (end) {
      query.endDate = { ...(query.endDate as Record<string, unknown>), $lte: end };
    }

    const total = await this.eventModel.countDocuments(query);
    const events = await this.eventModel
      .find(query)
      .sort({ startDate: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('team')
      .exec();

    return {
      success: true,
      data: {
        events,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    };
  }

  async getCalendar(clubId: Types.ObjectId, startDate: string, endDate: string, teamId?: string) {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);
    const query: Record<string, unknown> = {
      clubId,
      startDate: { $gte: start, $lte: end }
    };
    if (teamId) query.teamId = this.toObjectId(teamId);

    const events = await this.eventModel
      .find(query)
      .sort({ startDate: 1 })
      .populate('team')
      .exec();

    const calendar: Record<string, ErpEventDocument[]> = {};
    for (const event of events) {
      const key = event.startDate.toISOString().split('T')[0];
      if (!calendar[key]) calendar[key] = [];
      calendar[key].push(event);
    }

    return { success: true, data: { calendar, total: events.length } };
  }

  async findOne(id: string, clubId: Types.ObjectId) {
    const event = await this.eventModel
      .findOne({ _id: id, clubId })
      .populate('team')
      .exec();
    if (!event) {
      throw new NotFoundException(`Événement #${id} introuvable ou vous n'avez pas les droits`);
    }
    return event;
  }

  async create(clubId: Types.ObjectId, payload: Record<string, unknown>, createdBy?: Types.ObjectId) {
    const startDate = this.parseDate(String(payload['startDate'] ?? ''));
    const endDate = this.parseDate(String(payload['endDate'] ?? ''));
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate et endDate sont requis');
    }
    if (endDate < startDate) {
      throw new BadRequestException('La date de fin doit être après la date de début');
    }

    const event = new this.eventModel({
      ...payload,
      clubId,
      createdBy,
      startDate,
      endDate,
      teamId: payload['teamId'] ? this.toObjectId(String(payload['teamId'])) : undefined
    });

    return event.save();
  }

  async update(id: string, clubId: Types.ObjectId, payload: Record<string, unknown>, updatedBy?: Types.ObjectId) {
    const event = await this.findOne(id, clubId);

    if (payload['startDate']) {
      event.startDate = this.parseDate(String(payload['startDate']))!;
    }
    if (payload['endDate']) {
      event.endDate = this.parseDate(String(payload['endDate']))!;
    }

    if (event.endDate < event.startDate) {
      throw new BadRequestException('La date de fin doit être après la date de début');
    }

    if (payload['teamId']) {
      payload = { ...payload, teamId: this.toObjectId(String(payload['teamId'])) };
    }

    Object.assign(event, payload, { updatedBy });
    return event.save();
  }

  async updateStatus(id: string, clubId: Types.ObjectId, status: string) {
    const event = await this.findOne(id, clubId);
    event.status = status;
    return event.save();
  }

  async remove(id: string, clubId: Types.ObjectId) {
    const event = await this.findOne(id, clubId);
    await event.deleteOne();
    return { success: true, message: 'Événement supprimé avec succès' };
  }

  async getParticipants(eventId: string, clubId: Types.ObjectId) {
    await this.findOne(eventId, clubId);
    const participants = await this.participantModel
      .find({ eventId: this.toObjectId(eventId) })
      .sort({ createdAt: 1 })
      .exec();

    const summary = {
      total: participants.length,
      confirmed: participants.filter(p => p.status === 'confirmed').length,
      declined: participants.filter(p => p.status === 'declined').length,
      pending: participants.filter(p => p.status === 'invited').length,
    };

    return { success: true, data: { participants, summary } };
  }

  async addParticipant(eventId: string, clubId: Types.ObjectId, payload: { participantType: string; participantId: string; notes?: string }) {
    await this.findOne(eventId, clubId);
    const existing = await this.participantModel.findOne({
      eventId: this.toObjectId(eventId),
      participantType: payload.participantType,
      participantId: this.toObjectId(payload.participantId)
    });
    if (existing) {
      throw new ConflictException('Ce participant est déjà invité à cet événement');
    }

    const participant = new this.participantModel({
      eventId: this.toObjectId(eventId),
      participantType: payload.participantType,
      participantId: this.toObjectId(payload.participantId),
      notes: payload.notes
    });
    return participant.save();
  }

  async updateParticipantStatus(
    eventId: string,
    clubId: Types.ObjectId,
    participantId: string,
    status: string
  ) {
    await this.findOne(eventId, clubId);
    const participant = await this.participantModel.findOne({
      eventId: this.toObjectId(eventId),
      participantId: this.toObjectId(participantId)
    });
    if (!participant) {
      throw new NotFoundException('Participant introuvable');
    }
    participant.status = status;
    participant.responseDate = new Date();
    return participant.save();
  }

  async removeParticipant(eventId: string, clubId: Types.ObjectId, participantId: string) {
    await this.findOne(eventId, clubId);
    await this.participantModel.deleteOne({
      eventId: this.toObjectId(eventId),
      participantId: this.toObjectId(participantId)
    });
    return { success: true, message: 'Participant supprimé' };
  }
}

import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { EventParticipant, ParticipantType, ParticipationStatus } from './entities/event-participant.entity';
import { Notification, NotificationType, DeliveryStatus } from '../notifications/entities/notification.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { User } from '../users/entities/user.entity';

export interface EventsFilter {
    eventType?: string;
    teamId?: string;
    status?: EventStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

@Injectable()
export class EventsService {
    constructor(
        @InjectRepository(Event)
        private readonly eventRepository: Repository<Event>,
        @InjectRepository(EventParticipant)
        private readonly participantRepository: Repository<EventParticipant>,
        @InjectRepository(Notification)
        private readonly notificationRepository: Repository<Notification>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    // ─── CRUD ──────────────────────────────────────────────────────

    async findAll(clubId: string, filters: EventsFilter = {}) {
        const { eventType, teamId, status, startDate, endDate, page = 1, limit = 50 } = filters;

        const query = this.eventRepository.createQueryBuilder('event')
            .leftJoinAndSelect('event.team', 'team')
            .leftJoinAndSelect('event.creator', 'creator')
            .where('event.clubId = :clubId', { clubId });

        if (eventType) query.andWhere('event.eventType = :eventType', { eventType });
        if (teamId) query.andWhere('event.teamId = :teamId', { teamId });
        if (status) query.andWhere('event.status = :status', { status });
        if (startDate) query.andWhere('event.startDate >= :startDate', { startDate: new Date(startDate) });
        if (endDate) query.andWhere('event.endDate <= :endDate', { endDate: new Date(endDate) });

        const total = await query.getCount();
        const events = await query
            .orderBy('event.startDate', 'ASC')
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();

        return { success: true, data: { events, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } } };
    }

    /**
     * Calendar view: group events by date for a given month or week range
     */
    async getCalendar(clubId: string, startDate: string, endDate: string, teamId?: string) {
        const where: any = {
            clubId,
            startDate: Between(new Date(startDate), new Date(endDate)),
        };
        if (teamId) where.teamId = teamId;

        const events = await this.eventRepository.find({
            where,
            relations: ['team'],
            order: { startDate: 'ASC' },
        });

        // Group by date (YYYY-MM-DD)
        const calendar: Record<string, Event[]> = {};
        for (const event of events) {
            const dateKey = event.startDate.toISOString().split('T')[0];
            if (!calendar[dateKey]) calendar[dateKey] = [];
            calendar[dateKey].push(event);
        }

        return { success: true, data: { calendar, total: events.length } };
    }

    async findOne(id: string, clubId: string): Promise<Event> {
        const event = await this.eventRepository.findOne({
            where: { id, clubId },
            relations: ['team', 'creator'],
        });
        if (!event) throw new NotFoundException(`Événement #${id} introuvable ou vous n'avez pas les droits`);
        return event;
    }

    async create(createEventDto: CreateEventDto, createdBy: string): Promise<Event> {
        if (new Date(createEventDto.endDate) < new Date(createEventDto.startDate)) {
            throw new BadRequestException('La date de fin doit être après la date de début');
        }

        const event = this.eventRepository.create({
            ...createEventDto,
            createdBy,
            startDate: new Date(createEventDto.startDate),
            endDate: new Date(createEventDto.endDate),
        });
        const saved = await this.eventRepository.save(event);

        // Auto-notify all club users about the new event
        await this.notifyClubUsers(saved.clubId, {
            title: `Nouvel événement : ${saved.title}`,
            message: `Un événement "${saved.title}" a été créé pour le ${saved.startDate.toLocaleDateString('fr-FR')}.`,
            notificationType: NotificationType.NEW_EVENT,
            relatedEntityType: 'event',
            relatedEntityId: saved.id,
        });

        return saved;
    }

    async update(id: string, clubId: string, updateEventDto: UpdateEventDto, updatedBy: string): Promise<Event> {
        const event = await this.findOne(id, clubId);

        if (updateEventDto.startDate) event.startDate = new Date(updateEventDto.startDate);
        if (updateEventDto.endDate) event.endDate = new Date(updateEventDto.endDate);

        if (event.endDate < event.startDate) {
            throw new BadRequestException('La date de fin doit être après la date de début');
        }

        Object.assign(event, updateEventDto);
        const updated = await this.eventRepository.save(event);

        // Notify participants that event was updated
        await this.notifyEventParticipants(id, {
            title: `Événement modifié : ${updated.title}`,
            message: `L'événement "${updated.title}" a été mis à jour.`,
            notificationType: NotificationType.EVENT_UPDATED,
            relatedEntityType: 'event',
            relatedEntityId: id,
        });

        return updated;
    }

    async updateStatus(id: string, clubId: string, dto: UpdateEventStatusDto): Promise<Event> {
        const event = await this.findOne(id, clubId);
        event.status = dto.status;
        const updated = await this.eventRepository.save(event);

        if (dto.status === EventStatus.CANCELLED) {
            await this.notifyEventParticipants(id, {
                title: `Événement annulé : ${event.title}`,
                message: `L'événement "${event.title}" a été annulé.${dto.reason ? ' Raison : ' + dto.reason : ''}`,
                notificationType: NotificationType.EVENT_CANCELLED,
                relatedEntityType: 'event',
                relatedEntityId: id,
            });
        }

        return updated;
    }

    async remove(id: string, clubId: string): Promise<{ success: boolean; message: string }> {
        const event = await this.findOne(id, clubId);
        await this.eventRepository.remove(event);
        return { success: true, message: 'Événement supprimé avec succès' };
    }

    // ─── Participants ───────────────────────────────────────────────

    async getParticipants(eventId: string, clubId: string) {
        await this.findOne(eventId, clubId);
        const participants = await this.participantRepository.find({
            where: { eventId },
            order: { createdAt: 'ASC' },
        });

        const summary = {
            total: participants.length,
            confirmed: participants.filter(p => p.status === ParticipationStatus.CONFIRMED).length,
            declined: participants.filter(p => p.status === ParticipationStatus.DECLINED).length,
            pending: participants.filter(p => p.status === ParticipationStatus.INVITED).length,
        };

        return { success: true, data: { participants, summary } };
    }

    async addParticipant(eventId: string, clubId: string, dto: AddParticipantDto): Promise<EventParticipant> {
        await this.findOne(eventId, clubId);

        const existing = await this.participantRepository.findOne({
            where: { eventId, participantType: dto.participantType, participantId: dto.participantId },
        });
        if (existing) throw new ConflictException('Ce participant est déjà invité à cet événement');

        const participant = this.participantRepository.create({
            eventId,
            participantType: dto.participantType,
            participantId: dto.participantId,
            notes: dto.notes,
        });
        return this.participantRepository.save(participant);
    }

    async updateParticipantStatus(
        eventId: string,
        clubId: string,
        participantId: string,
        status: ParticipationStatus,
    ): Promise<EventParticipant> {
        const participant = await this.participantRepository.findOne({
            where: { eventId, participantId },
            relations: ['event'],
        });
        if (!participant || participant.event.clubId !== clubId) {
            throw new NotFoundException('Participant introuvable ou accès refusé');
        }

        participant.status = status;
        participant.responseDate = new Date();
        return this.participantRepository.save(participant);
    }

    async removeParticipant(eventId: string, clubId: string, participantId: string): Promise<{ success: boolean; message: string }> {
        const participant = await this.participantRepository.findOne({
            where: { eventId, participantId },
            relations: ['event'],
        });
        if (!participant || participant.event.clubId !== clubId) {
            throw new NotFoundException('Participant introuvable ou accès refusé');
        }
        await this.participantRepository.remove(participant);
        return { success: true, message: 'Participant retiré de l\'événement' };
    }

    // ─── Internal notification helpers ─────────────────────────────

    private async notifyClubUsers(
        clubId: string,
        payload: {
            title: string;
            message: string;
            notificationType: NotificationType;
            relatedEntityType?: string;
            relatedEntityId?: string;
        },
    ): Promise<void> {
        const users = await this.userRepository.find({ where: { clubId } });
        const notifications = users.map(user =>
            this.notificationRepository.create({
                userId: user.id,
                title: payload.title,
                message: payload.message,
                notificationType: payload.notificationType,
                relatedEntityType: payload.relatedEntityType,
                relatedEntityId: payload.relatedEntityId,
                deliveryStatus: DeliveryStatus.SENT,
            }),
        );
        if (notifications.length > 0) {
            await this.notificationRepository.save(notifications);
        }
    }

    private async notifyEventParticipants(
        eventId: string,
        payload: {
            title: string;
            message: string;
            notificationType: NotificationType;
            relatedEntityType?: string;
            relatedEntityId?: string;
        },
    ): Promise<void> {
        const participants = await this.participantRepository.find({ where: { eventId } });
        const notifications = participants.map(p =>
            this.notificationRepository.create({
                userId: p.participantId,
                title: payload.title,
                message: payload.message,
                notificationType: payload.notificationType,
                relatedEntityType: payload.relatedEntityType,
                relatedEntityId: payload.relatedEntityId,
                deliveryStatus: DeliveryStatus.SENT,
            }),
        );
        if (notifications.length > 0) {
            await this.notificationRepository.save(notifications);
        }
    }
}

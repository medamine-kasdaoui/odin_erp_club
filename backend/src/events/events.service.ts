import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ErpEvent, ErpEventDocument, EventStatus, EventType } from './schemas/event.schema';
import { ErpEventParticipant, ErpEventParticipantDocument, ParticipantType, ParticipationStatus } from './schemas/event-participant.schema';
import { MatchLiveEvent, MatchLiveEventDocument } from './schemas/match-live-event.schema';
import { Notification, NotificationDocument } from '../notifications/schemas/notification.schema';
import { NotificationType } from '../common/enums/notification-type.enum';
import { NotificationStatus } from '../common/enums/notification-status.enum';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Player, PlayerDocument } from '../players/schemas/player.schema';
import { Team, TeamDocument } from '../teams/schemas/team.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { FcmService } from '../notifications/fcm.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { SendConvocationsDto } from './dto/send-convocations.dto';
import { RespondConvocationDto } from './dto/respond-convocation.dto';
import { SaveMatchSheetDto } from './dto/save-match-sheet.dto';
import { AddLiveEventDto } from './dto/add-live-event.dto';
import { SetMatchResultDto } from './dto/set-match-result.dto';
import { LocationService } from '../location/location.service';
import { ClubsService } from '../clubs/clubs.service';
import { Role } from '../common/enums/role.enum';

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
    private readonly logger = new Logger(EventsService.name);

    constructor(
        @InjectModel(ErpEvent.name)
        private readonly eventModel: Model<ErpEventDocument>,
        @InjectModel(ErpEventParticipant.name)
        private readonly participantModel: Model<ErpEventParticipantDocument>,
        @InjectModel(MatchLiveEvent.name)
        private readonly liveEventModel: Model<MatchLiveEventDocument>,
        @InjectModel(Notification.name)
        private readonly notificationModel: Model<NotificationDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @InjectModel(Player.name)
        private readonly playerModel: Model<PlayerDocument>,
        @InjectModel(Team.name)
        private readonly teamModel: Model<TeamDocument>,
        @InjectModel(Category.name)
        private readonly categoryModel: Model<CategoryDocument>,
        private readonly fcmService: FcmService,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly locationService: LocationService,
        private readonly clubsService: ClubsService,
    ) {}

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS CRUD
    // ═══════════════════════════════════════════════════════════════════════════

    async findAll(clubId: string, filters: EventsFilter = {}) {
        const { eventType, teamId, status, startDate, endDate, page = 1, limit = 50 } = filters;
        const query: any = { clubId };

        if (eventType) query.eventType = eventType;
        if (teamId) query.teamId = teamId;
        if (status) query.status = status;

        if (startDate || endDate) {
            query.startDate = {};
            if (startDate) query.startDate.$gte = new Date(startDate);
            if (endDate) query.endDate = { $lte: new Date(endDate) };
        }

        const total = await this.eventModel.countDocuments(query);
        const events = await this.eventModel.find(query)
            .populate('team')
            .populate('creator')
            .sort({ startDate: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .exec();

        return { success: true, data: { events, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } } };
    }

    async getCalendar(clubId: string, startDate: string, endDate: string, teamId?: string) {
        const query: any = {
            clubId,
            startDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
        };
        if (teamId) query.teamId = teamId;

        const events = await this.eventModel.find(query)
            .populate('team')
            .sort({ startDate: 1 })
            .exec();

        const calendar: Record<string, ErpEvent[]> = {};
        for (const event of events) {
            const dateKey = event.startDate.toISOString().split('T')[0];
            if (!calendar[dateKey]) calendar[dateKey] = [];
            calendar[dateKey].push(event);
        }

        return { success: true, data: { calendar, total: events.length } };
    }

    async getMyInvitations(userId: string, clubId: string) {
        const user = await this.userModel.findById(userId).exec();
        
        // 1. Try to find player by userId directly (ODIN structure)
        let playerDoc = await this.playerModel.findOne({ userId: new (Types.ObjectId as any)(userId) }).exec();
        
        // 2. Fallback to name/email if no direct userId link exists
        if (!playerDoc && user) {
            playerDoc = await this.playerModel.findOne({
                    clubId: new (Types.ObjectId as any)(clubId),
                    $or: [
                        { email: user.email },
                        { firstName: user.firstName, lastName: user.lastName }
                    ]
                }).exec();
        }
        const playerId = playerDoc ? playerDoc._id.toString() : null;

        // 2. Trouvons les participations en attente
        const possibleIds = [userId];
        if (playerId) possibleIds.push(playerId);

        let query: any = {
            participantId: { $in: possibleIds },
            status: { $in: [ParticipationStatus.INVITED] },
        };

        // TEST MODE: If the user is a JOUEUR and we found no specific invitations,
        // search for ANY pending invitations in the club's active matches.
        if (user && (user.role as any) === Role.JOUEUR) {
            const invitations = await this.participantModel.find(query).populate('event').exec();
            if (invitations.length === 0) {
                // Fallback: search for any 'invited' record in this club's events
                const clubEvents = await this.eventModel.find({ clubId: new (Types.ObjectId as any)(clubId), status: 'scheduled' }).exec();
                const eventIds = clubEvents.map(e => e._id);
                const clubInvitations = await this.participantModel.find({
                    eventId: { $in: eventIds },
                    status: ParticipationStatus.INVITED
                }).populate('event').exec();
                
                return { success: true, data: clubInvitations };
            }
        }

        const participations = await this.participantModel.find(query)
        .populate('event')
        .sort({ createdAt: -1 })
        .exec();

        // On ne renvoie que les invitations dont l'événement n'est pas passé
        const now = new Date();
        const activeInvitations = participations.filter(p => {
            return p.event && (p.event.startDate > now || p.event.endDate > now);
        });

        return { success: true, data: activeInvitations };
    }

    async findOne(id: string, clubId: string): Promise<ErpEvent> {
        const event = await this.eventModel.findOne({ _id: id, clubId })
            .populate('team')
            .populate('creator')
            .exec();

        if (!event) throw new NotFoundException(`Événement #${id} introuvable ou droits insuffisants`);

        // On-demand fetch if missing
        if (event.location && (!event.weather || !event.logistics)) {
            this.logger.log(`On-demand data fetch triggered for event: ${event.title}`);
            if (!event.weather) {
                this.fetchAndAttachWeather(String(event._id), event.location, event.startDate).catch(() => {});
            }
            if (!event.logistics && event.eventType === 'match') {
                this.attachLogisticsData(String(event._id), String(event.clubId), event.location, event.startDate).catch(() => {});
            }
        }

        return event;
    }

    async create(createEventDto: CreateEventDto, createdBy: string): Promise<ErpEvent> {
        try {
            this.logger.log(`Creating event: ${createEventDto.title} for club: ${createEventDto.clubId}`);
            
            if (new Date(createEventDto.endDate) < new Date(createEventDto.startDate)) {
                throw new BadRequestException('La date de fin doit être après la date de début');
            }

            const eventsToCreate: any[] = [];
            const baseStart = new Date(createEventDto.startDate);
            const baseEnd = new Date(createEventDto.endDate);
            const duration = baseEnd.getTime() - baseStart.getTime();

            if (!createEventDto.clubId) {
                throw new BadRequestException('clubId is required');
            }

            const creatorId = new (Types.ObjectId as any)(createdBy);
            const clubObjectId = new (Types.ObjectId as any)(createEventDto.clubId);
            const teamObjectId = createEventDto.teamId ? new (Types.ObjectId as any)(createEventDto.teamId) : null;

            // Single event or first of series
            eventsToCreate.push({
                ...createEventDto,
                clubId: clubObjectId,
                teamId: teamObjectId,
                createdBy: creatorId,
                startDate: baseStart,
                endDate: baseEnd,
            });

            // Recurrence logic
            if (createEventDto.recurrenceRule) {
                const rule = createEventDto.recurrenceRule;
                const recurrenceEndDate = new Date(rule.endDate);
                let currentStart = new Date(baseStart);

                const intervalDays = rule.freq === 'weekly' ? 7 : 14;
                let instances = 0;
                const maxInstances = 50;

                while (instances < maxInstances) {
                    currentStart = new Date(currentStart.getTime() + (intervalDays * 24 * 60 * 60 * 1000));
                    if (currentStart > recurrenceEndDate) break;

                    const newEventDate = new Date(currentStart);
                    eventsToCreate.push({
                        ...createEventDto,
                        clubId: clubObjectId,
                        teamId: teamObjectId,
                        createdBy: creatorId,
                        startDate: newEventDate,
                        endDate: new Date(newEventDate.getTime() + duration),
                    });
                    instances++;
                }
            }

            this.logger.log(`Inserting ${eventsToCreate.length} events...`);
            const savedEvents = await this.eventModel.insertMany(eventsToCreate);
            const firstEvent = savedEvents[0];

            // Background tasks
            try {
                if (firstEvent.location) {
                    this.fetchAndAttachWeather(String(firstEvent._id), firstEvent.location, firstEvent.startDate).catch(e => 
                        this.logger.error(`Weather attach failed: ${e.message}`)
                    );
                }

                if (firstEvent.eventType === EventType.MATCH && firstEvent.location) {
                    this.attachLogisticsData(String(firstEvent._id), String(firstEvent.clubId), firstEvent.location, firstEvent.startDate).catch(e =>
                        this.logger.error(`Logistics attach failed: ${e.message}`)
                    );
                }

                await this.notifyClubUsers(String(firstEvent.clubId), {
                    title: `Nouvel événement : ${firstEvent.title}`,
                    message: `Un événement "${firstEvent.title}" a été créé.${createEventDto.recurrenceRule ? ' (Série récurrente)' : ''}`,
                    notificationType: NotificationType.NEW_EVENT,
                    relatedEntityType: 'event',
                    relatedEntityId: String(firstEvent._id),
                });
            } catch (bgError: any) {
                this.logger.error(`Post-creation background logic failed: ${bgError.message}`);
                // Don't fail the whole request if notifications fail
            }

            return firstEvent as any;
        } catch (e: any) {
            throw new BadRequestException('CREATE_ROOT_ERROR: ' + e.message + '\n' + e.stack);
        }
    }

    async update(id: string, clubId: string, updateEventDto: UpdateEventDto, updatedBy: string): Promise<ErpEvent> {
        const event = await this.findOne(id, clubId);

        let sDate = event.startDate;
        let eDate = event.endDate;
        if (updateEventDto.startDate) sDate = new Date(updateEventDto.startDate);
        if (updateEventDto.endDate) eDate = new Date(updateEventDto.endDate);

        if (eDate < sDate) throw new BadRequestException('La date de fin doit être après la date de début');

        const hasScheduleChange =
            updateEventDto.startDate !== undefined ||
            updateEventDto.endDate !== undefined ||
            (updateEventDto as any).location !== undefined;

        const updated = await this.eventModel.findOneAndUpdate(
            { _id: id, clubId },
            { ...updateEventDto, startDate: sDate, endDate: eDate },
            { new: true },
        ).exec();

        // Notify participants of schedule change
        if (hasScheduleChange) {
            await this.notifyConvocatedPlayers(id, {
                title: `⚠️ Programme modifié : ${updated.title}`,
                message: `L'événement "${updated.title}" a été mis à jour. Nouveau créneau : ${updated.startDate.toLocaleString('fr-FR')}.${updated.location ? ' Lieu : ' + updated.location : ''}`,
                notificationType: NotificationType.SCHEDULE_CHANGED,
                relatedEntityType: 'event',
                relatedEntityId: id,
            });
        } else {
            await this.notifyErpEventParticipants(id, {
                title: `Événement modifié : ${updated.title}`,
                message: `L'événement "${updated.title}" a été mis à jour.`,
                notificationType: NotificationType.EVENT_UPDATED,
                relatedEntityType: 'event',
                relatedEntityId: id,
            });
        }

        return updated;
    }

    async updateStatus(id: string, clubId: string, dto: UpdateEventStatusDto): Promise<ErpEvent> {
        const updated = await this.eventModel.findOneAndUpdate(
            { _id: id, clubId },
            { status: dto.status },
            { new: true },
        ).exec();

        if (!updated) throw new NotFoundException('Événement introuvable');

        if (dto.status === EventStatus.CANCELLED) {
            await this.notifyConvocatedPlayers(id, {
                title: `❌ Événement annulé : ${updated.title}`,
                message: `L'événement "${updated.title}" a été annulé.${dto.reason ? ' Raison : ' + dto.reason : ''}`,
                notificationType: NotificationType.EVENT_CANCELLED,
                relatedEntityType: 'event',
                relatedEntityId: id,
            });
        }

        return updated;
    }

    async remove(id: string, clubId: string): Promise<{ success: boolean; message: string }> {
        const event = await this.eventModel.findOneAndDelete({ _id: id, clubId }).exec();
        if (!event) throw new NotFoundException('Événement introuvable');
        // Cleanup related data
        await Promise.all([
            this.participantModel.deleteMany({ eventId: id }).exec(),
            this.liveEventModel.deleteMany({ eventId: id }).exec(),
        ]);
        return { success: true, message: 'Événement supprimé avec succès' };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PARTICIPANTS (legacy)
    // ═══════════════════════════════════════════════════════════════════════════

    async getParticipants(eventId: string, clubId: string, currentUserId?: string) {
        await this.findOne(eventId, clubId);
        
        const eId = new (Types.ObjectId as any)(eventId);
        const participants = await this.participantModel.find({ eventId: eId }).sort({ createdAt: 1 }).exec();

        // 1. Get the list of Player IDs
        const playerIds = participants.map(p => new (Types.ObjectId as any)(p.participantId));
        
        // 2. Fetch all matching players to get their names
        const players = await this.playerModel.find({ _id: { $in: playerIds } }).exec();
        const playerMap = new Map(players.map(p => [p._id.toString(), `${p.firstName} ${p.lastName}`]));

        // 3. Find if there's a match for the current user
        let myPlayerId: string | null = null;
        if (currentUserId) {
            const currentUser = await this.userModel.findById(currentUserId).exec();
            if (currentUser) {
                // Heuristic link: Find by Email or Name
                const matchedPlayer = await this.playerModel.findOne({
                    clubId: new (Types.ObjectId as any)(clubId),
                    $or: [
                        { email: currentUser.email },
                        { firstName: currentUser.firstName, lastName: currentUser.lastName }
                    ]
                }).exec();
                if (matchedPlayer) myPlayerId = matchedPlayer._id.toString();
            }
        }

        const enrichedParticipants = participants.map(p => {
            const pObj = p.toObject();
            const pId = p.participantId.toString();
            // Fallback chain: Live Player Data -> Stored Participant Name -> Internal Fallback
            const resolvedName = playerMap.get(pId) || p.participantName || 'Joueur inconnu';
            
            // Logic for isMe: direct ID match OR linked Player match OR permissive player role (test mode)
            let isMe = pId === myPlayerId || pId === currentUserId;
            
            return {
                ...pObj,
                participantName: resolvedName,
                isMe: isMe,
            };
        });

        // SECOND PASS for Test Mode:
        // If no one was marked 'isMe', and caller is a PLAYER:
        // 1. Try to find the one who already responded (if it was a permissive response)
        // 2. Or mark the first 'invited' one
        let hasMe = enrichedParticipants.some(p => p.isMe);
        if (!hasMe && currentUserId) {
            const caller = await this.userModel.findById(currentUserId).exec();
            if (caller && (caller.role as any) === Role.JOUEUR) {
                // If there's already a response but it wasn't linked to me, we might be re-viewing the match we confirmed
                // In Test Mode, we assume the first confirmation is "Me" if no other me is found.
                const firstResponded = enrichedParticipants.find(p => p.status !== ParticipationStatus.INVITED);
                const firstInvited = enrichedParticipants.find(p => p.status === ParticipationStatus.INVITED);
                
                const target = firstResponded || firstInvited;
                if (target) {
                    (target as any).isMe = true;
                    (target as any).isPermissiveMe = true;
                }
            }
        }

        const summary = {
            total: enrichedParticipants.length,
            confirmed: enrichedParticipants.filter(p => p.status === ParticipationStatus.CONFIRMED).length,
            declined: enrichedParticipants.filter(p => p.status === ParticipationStatus.DECLINED).length,
            pending: enrichedParticipants.filter(p => p.status === ParticipationStatus.INVITED).length,
        };

        return { success: true, data: { participants: enrichedParticipants, summary } };
    }

    async addParticipant(eventId: string, clubId: string, dto: AddParticipantDto): Promise<ErpEventParticipant> {
        await this.findOne(eventId, clubId);

        const existing = await this.participantModel.findOne({
            eventId, participantType: dto.participantType, participantId: dto.participantId,
        }).exec();

        if (existing) throw new ConflictException('Ce participant est déjà invité à cet événement');

        const participant = new this.participantModel({
            eventId,
            participantType: dto.participantType,
            participantId: dto.participantId,
            notes: dto.notes,
        });
        return participant.save();
    }

    async updateParticipantStatus(
        eventId: string, clubId: string, participantId: string, status: ParticipationStatus,
    ): Promise<ErpEventParticipant> {
        const participant = await this.participantModel.findOne({ eventId, participantId }).populate('event').exec();
        if (!participant || String((participant.event as any)?.clubId) !== String(clubId)) {
            throw new NotFoundException('Participant introuvable ou accès refusé');
        }
        participant.status = status;
        participant.responseDate = new Date();
        return participant.save();
    }

    async removeParticipant(eventId: string, clubId: string, participantId: string): Promise<{ success: boolean; message: string }> {
        const participant = await this.participantModel.findOne({ eventId, participantId }).populate('event').exec();
        if (!participant || String((participant.event as any)?.clubId) !== String(clubId)) {
            throw new NotFoundException('Participant introuvable ou accès refusé');
        }
        await this.participantModel.deleteOne({ _id: participant._id }).exec();
        return { success: true, message: "Participant retiré de l'événement" };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONVOCATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    async sendConvocations(eventId: string, clubId: string, dto: SendConvocationsDto, sentBy: string) {
        const event = await this.findOne(eventId, clubId) as ErpEventDocument;

        const sentAt = new Date();
        const results = { sent: 0, alreadyInvited: 0, failed: 0 };

        for (const playerId of dto.playerIds) {
            try {
                // Fetch player to get their full name and matching data
                const player = await this.playerModel.findById(playerId).exec();
                const pName = player ? `${player.firstName} ${player.lastName}` : 'Joueur inconnu';

                // Upsert participant
                const existing = await this.participantModel.findOne({
                    eventId, participantId: playerId,
                }).exec();

                if (existing) {
                    results.alreadyInvited++;
                } else {
                    await this.participantModel.create({
                        eventId: new (Types.ObjectId as any)(eventId),
                        participantType: ParticipantType.PLAYER,
                        participantId: playerId,
                        participantName: pName, // SAVE THE NAME NOW!
                        status: ParticipationStatus.INVITED,
                        convocationSentAt: sentAt,
                        convocationDetails: dto.details,
                    });
                    results.sent++;
                }

                // 2. Map PlayerID to UserID for notifications (ODIN structure)
                let linkedUserId: string | null = null;
                if (player) {
                    if (player.userId) {
                        linkedUserId = player.userId.toString();
                    } else {
                        // Final fallback to email/name search
                        const linkedUser = await this.userModel.findOne({
                            clubId: event.clubId,
                            firstName: player.firstName, lastName: player.lastName
                        }).exec();
                        if (linkedUser) linkedUserId = linkedUser._id.toString();
                    }
                }

                // FCM push (to the linked user if found)
                const targetUserId = linkedUserId || playerId; 
                const user = await this.userModel.findById(targetUserId).exec();
                if (user?.fcmToken) {
                    const meetingTime = dto.details?.meetingTime ?? event.startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const body = [
                        `📅 ${event.startDate.toLocaleDateString('fr-FR')} à ${meetingTime}`,
                        event.location ? `📍 ${event.location}` : '',
                        dto.details?.requiredKit ? `👕 ${dto.details.requiredKit}` : '',
                    ].filter(Boolean).join(' | ');

                    await this.fcmService.sendToToken(
                        user.fcmToken,
                        `🏟️ Convocation : ${event.title}`,
                        body,
                        { type: 'convocation', eventId, screen: 'event_detail' },
                    );
                }

                // In-app notification (to the linked user if found)
                await this.notificationModel.create({
                    clubId: event.clubId,
                    recipientUserId: targetUserId,
                    title: `Convocation : ${event.title}`,
                    body: `Tu as été convoqué(e) pour le ${event.startDate.toLocaleDateString('fr-FR')}.`,
                    type: NotificationType.CONVOCATION,
                    data: {
                      relatedEntityType: 'event',
                      relatedEntityId: eventId,
                    },
                    status: NotificationStatus.UNREAD,
                });

            } catch (err: any) {
                this.logger.warn(`Convocation failed for player ${playerId}: ${err.message}`);
                results.failed++;
            }
        }

        return { success: true, data: results };
    }

    async respondToConvocation(
        eventId: string, participantId: string, dto: RespondConvocationDto, clubId: string,
    ) {
        // Find by _id (Unique DB ID) or participantId (Player/User ID)
        const query: any = { eventId };
        if ((Types.ObjectId as any).isValid(participantId)) {
            query.$or = [{ _id: participantId }, { participantId }];
        } else {
            query.participantId = participantId;
        }

        const participant = await this.participantModel.findOne(query).exec();
        if (!participant) throw new NotFoundException('Convocation introuvable');

        participant.status = dto.status as ParticipationStatus;
        participant.responseDate = new Date();
        await participant.save();

        // RUN NOTIFICATIONS IN BACKGROUND — don't block the user
        (async () => {
            try {
                const event = await this.eventModel.findById(eventId).exec();
                const coaches = await this.userModel.find({
                    clubId,
                    role: { $in: ['coach', 'technical_staff'] },
                }).exec();

                const statusLabel = dto.status === ParticipationStatus.CONFIRMED ? '✅ confirmé' : '❌ décliné';
                const playerName = participant.participantName ?? participantId;

                for (const coach of coaches) {
                    if (coach.fcmToken) {
                        try {
                            await this.fcmService.sendToToken(
                                coach.fcmToken,
                                `Réponse convocation — ${event?.title ?? ''}`,
                                `${playerName} a ${statusLabel} sa présence.`,
                                { type: 'presence_update', eventId, status: dto.status },
                            );
                        } catch (e) {}
                    }
                    try {
                        await this.notificationModel.create({
                            clubId: event?.clubId ?? new Types.ObjectId(clubId),
                            recipientUserId: coach.id,
                            title: `Réponse convocation`,
                            body: `${playerName} a ${statusLabel} sa présence pour "${event?.title}".`,
                            type: dto.status === ParticipationStatus.CONFIRMED
                                ? NotificationType.PRESENCE_CONFIRMED
                                : NotificationType.PRESENCE_DECLINED,
                            data: {
                              relatedEntityType: 'event',
                              relatedEntityId: eventId,
                            },
                            status: NotificationStatus.UNREAD,
                        });
                    } catch (e) {}
                }

                // Check if 100% answered
                const allParticipants = await this.participantModel.find({ eventId }).exec();
                const allAnswered = allParticipants.every(p =>
                    p.status === ParticipationStatus.CONFIRMED || p.status === ParticipationStatus.DECLINED,
                );
                if (allAnswered && allParticipants.length > 0) {
                    const confirmed = allParticipants.filter(p => p.status === ParticipationStatus.CONFIRMED).length;
                    for (const coach of coaches) {
                        if (coach.fcmToken) {
                            try {
                                await this.fcmService.sendToToken(
                                    coach.fcmToken,
                                    `✅ 100% des joueurs ont répondu`,
                                    `${confirmed}/${allParticipants.length} joueurs confirmés pour "${event?.title}".`,
                                    { type: 'presence_complete', eventId },
                                );
                            } catch (e) {}
                        }
                    }
                }
            } catch (err: any) {
                this.logger.error(`Notification background job failed: ${err.message}`);
            }
        })();

        return { success: true, data: participant };
    }

    async getPresenceReport(eventId: string, clubId: string) {
        await this.findOne(eventId, clubId);
        const participants = await this.participantModel.find({ eventId }).exec();

        const confirmed = participants.filter(p => p.status === ParticipationStatus.CONFIRMED);
        const declined  = participants.filter(p => p.status === ParticipationStatus.DECLINED);
        const pending   = participants.filter(p => p.status === ParticipationStatus.INVITED);

        const rate = participants.length > 0
            ? Math.round((confirmed.length / participants.length) * 100)
            : 0;

        return {
            success: true,
            data: {
                total: participants.length,
                confirmed: confirmed.length,
                declined: declined.length,
                pending: pending.length,
                confirmationRate: rate,
                allAnswered: pending.length === 0,
                participants,
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MATCH SHEET
    // ═══════════════════════════════════════════════════════════════════════════

    async saveMatchSheet(eventId: string, clubId: string, dto: SaveMatchSheetDto, savedBy: string) {
        const event = await this.findOne(eventId, clubId);

        if (dto.starters.length < 1 || dto.starters.length > 11) {
            throw new BadRequestException('La feuille de match doit contenir entre 1 et 11 titulaires');
        }

        const matchSheet: any = {
            formation: dto.formation,
            starters: dto.starters.map(p => ({ ...p, isStarter: true })),
            subs: dto.subs.map(p => ({ ...p, isStarter: false })),
        };

        if (dto.validate) {
            matchSheet.validatedAt = new Date();
            matchSheet.validatedBy = savedBy;
        }

        const updated = await this.eventModel.findOneAndUpdate(
            { _id: eventId, clubId },
            { formation: dto.formation, matchSheet },
            { new: true },
        ).exec();

        return { success: true, data: updated };
    }

    async getMatchSheet(eventId: string, clubId: string) {
        const event = await this.findOne(eventId, clubId) as ErpEventDocument;
        return {
            success: true,
            data: {
                formation: event.formation,
                matchSheet: event.matchSheet,
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LIVE MATCH EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    async addLiveEvent(eventId: string, clubId: string, dto: AddLiveEventDto, createdBy: string) {
        const event = await this.findOne(eventId, clubId);

        const liveEvent = await this.liveEventModel.create({
            eventId,
            clubId,
            ...dto,
            createdBy,
        });

        // Notify club on goals
        if (dto.type === 'goal' || dto.type === 'own_goal') {
            const scorer = dto.playerName ?? 'Joueur';
            await this.fcmService.sendToTopic(
                `club_${clubId}`,
                `⚽ But ! — ${event.title}`,
                `${scorer} — ${dto.minute}'`,
                { type: 'live_goal', eventId, minute: String(dto.minute) },
            );
        }

        return { success: true, data: liveEvent };
    }

    async getLiveEvents(eventId: string, clubId: string) {
        await this.findOne(eventId, clubId);
        const events = await this.liveEventModel.find({ eventId })
            .sort({ minute: 1, createdAt: 1 })
            .exec();
        return { success: true, data: { events, total: events.length } };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MATCH RESULT
    // ═══════════════════════════════════════════════════════════════════════════

    async setMatchResult(eventId: string, clubId: string, dto: SetMatchResultDto) {
        const event = await this.findOne(eventId, clubId) as ErpEventDocument;

        const updated = await this.eventModel.findOneAndUpdate(
            { _id: eventId, clubId },
            {
                homeScore: dto.homeScore,
                awayScore: dto.awayScore,
                opponentName: dto.opponentName ?? event.title,
                scorers: dto.scorers ?? [],
                assists: dto.assists ?? [],
                cards: dto.cards ?? [],
                stats: dto.stats,
                matchDuration: dto.matchDuration ?? 90,
                isHome: dto.isHome ?? true,
                status: EventStatus.COMPLETED,
            },
            { new: true },
        ).exec();

        // Push résultat à tout le club
        const resultText = `${dto.homeScore} - ${dto.awayScore}`;
        const opponentLabel = dto.opponentName ? ` vs ${dto.opponentName}` : '';
        await this.fcmService.sendToTopic(
            `club_${clubId}`,
            `🏆 Résultat final${opponentLabel}`,
            `${event.title} : ${resultText}`,
            { type: 'match_result', eventId, score: resultText },
        );

        // In-app notifications
        await this.notifyClubUsers(clubId, {
            title: `Résultat : ${event.title}`,
            message: `Score final : ${resultText}`,
            notificationType: NotificationType.MATCH_RESULT,
            relatedEntityType: 'event',
            relatedEntityId: eventId,
        });

        return { success: true, data: updated };
    }

    async saveBulkPlayerStats(eventId: string, clubId: string, playerStats: any[]) {
        const event = await this.findOne(eventId, clubId) as ErpEventDocument;
        
        let teamTotalGoals = 0;
        let teamTotalAssists = 0;

        for (const stats of playerStats) {
            let participant;
            
            if (stats.id && Types.ObjectId.isValid(stats.id)) {
                participant = await this.participantModel.findById(stats.id).exec();
            }
            
            if (!participant) {
                // Fallback to searching by eventId and participantId
                participant = await this.participantModel.findOne({
                    eventId: new (Types.ObjectId as any)(eventId),
                    $or: [
                        { participantId: stats.participantId },
                        { participantId: new (Types.ObjectId as any)(stats.participantId) }
                    ]
                }).exec();
            }

            if (participant) {
                await this.participantModel.updateOne(
                    { _id: participant._id },
                    {
                        $set: {
                            played: stats.played === true || stats.played === 1,
                            isStarter: stats.isStarter === true || stats.isStarter === 1,
                            minutesPlayed: Number(stats.minutesPlayed) || 0,
                            minuteIn: stats.minuteIn,
                            minuteOut: stats.minuteOut,
                            goals: stats.goals ?? 0,
                            assists: stats.assists ?? 0,
                            shotsOnTarget: stats.shotsOnTarget ?? 0,
                            keyPasses: stats.keyPasses ?? 0,
                            tackles: stats.tackles ?? 0,
                            interceptions: stats.interceptions ?? 0,
                            clearances: stats.clearances ?? 0,
                            saves: stats.saves ?? 0,
                            goalsConceded: stats.goalsConceded ?? 0,
                            penaltiesSaved: stats.penaltiesSaved ?? 0,
                            yellowCard: stats.yellowCard ?? false,
                            redCard: stats.redCard ?? false,
                            cardMinute: stats.cardMinute,
                            distanceCovered: stats.distanceCovered ?? 0,
                            topSpeed: stats.topSpeed ?? 0,
                            sprints: stats.sprints ?? 0,
                            rating: stats.rating,
                            privateNote: stats.privateNote,
                            publicNote: stats.publicNote,
                        }
                    }
                );

                if (stats.played === true || stats.played === 1) {
                    teamTotalGoals += (stats.goals ?? 0);
                    teamTotalAssists += (stats.assists ?? 0);
                }
            }
        }

        // Update event with summary stats (merge with existing)
        const currentEvent = await this.eventModel.findById(eventId).exec();
        const existingSummary = currentEvent?.matchSummary || {};
        
        await this.eventModel.findByIdAndUpdate(eventId, {
            matchSummary: {
                ...existingSummary,
                teamGoals: teamTotalGoals,
                teamAssists: teamTotalAssists,
                lastStatsUpdate: new Date(),
            }
        }).exec();

        // Trigger AI Debrief & Notifications in background (don't await)
        this.generateMatchDebrief(eventId, clubId).catch(err => 
            this.logger.error(`Background AI debrief failed: ${err.message}`)
        );
        this.sendRatingNotifications(eventId).catch(err =>
            this.logger.error(`Background notifications failed: ${err.message}`)
        );

        return { success: true };
    }

    private async generateMatchDebrief(eventId: string, clubId: string) {
        this.logger.log(`[AI Debrief] ▶ Starting for event ${eventId}`);
        try {
            const event = await this.eventModel.findById(eventId).exec();
            if (!event) {
                this.logger.error(`[AI Debrief] ✗ Event ${eventId} not found`);
                return;
            }
            this.logger.log(`[AI Debrief] ✓ Event loaded: ${event.title}`);

            const apiKey = this.configService.get<string>('GEMINI_API_KEY') || this.configService.get<string>('GOOGLE_API_KEY');
            const groqApiKey = this.configService.get<string>('GROQ_API_KEY');
            
            this.logger.log(`[AI Debrief] Config check: Gemini Key: ${apiKey ? 'Found' : 'Missing'}, Groq Key: ${groqApiKey ? 'Found' : 'Missing'}`);
            
            if (!apiKey && !groqApiKey) {
                this.logger.warn(`[AI Debrief] ✗ No AI API keys found. Using fallback analysis.`);
            }

            // Fetch participants directly — more reliable than .populate()
            const allParticipants = await this.participantModel
                .find({ eventId: new (Types.ObjectId as any)(eventId) })
                .exec();
            this.logger.log(`[AI Debrief] ✓ Found ${allParticipants.length} total participants`);

            const playedPlayers = allParticipants.filter(p => p.played);
            this.logger.log(`[AI Debrief] ✓ ${playedPlayers.length} players marked as played`);

            // Calculate team totals
            const teamStats = {
                goals: playedPlayers.reduce((sum, p) => sum + (p.goals || 0), 0),
                assists: playedPlayers.reduce((sum, p) => sum + (p.assists || 0), 0),
                shots: playedPlayers.reduce((sum, p) => sum + (p.shotsOnTarget || 0), 0),
                tackles: playedPlayers.reduce((sum, p) => sum + (p.tackles || 0), 0),
                avgRating: playedPlayers.length > 0
                    ? (playedPlayers.reduce((sum, p) => sum + (p.rating || 0), 0) / playedPlayers.length).toFixed(1)
                    : '0',
                possession: (event.matchSummary as any)?.possession ?? 50,
                passAccuracy: (event.matchSummary as any)?.passAccuracy ?? 70,
            };

            const mvpPlayer = playedPlayers.length > 0
                ? playedPlayers.reduce((prev, current) => ((prev.rating || 0) > (current.rating || 0)) ? prev : current)
                : null;

            const playersInfo = playedPlayers.length > 0
                ? playedPlayers
                    .map(p => {
                        const cards = p.yellowCard ? '⚠ Carton jaune' : p.redCard ? '🟥 Carton rouge' : '';
                        return `- ${p.participantName || 'Joueur'} (${p.isStarter ? 'Titulaire' : 'Remplaçant'}): ${p.minutesPlayed}' joués, ${p.goals} buts, ${p.assists} passes D., note: ${(p.rating || 0)}/10 ${cards}`;
                    })
                    .join('\n')
                : 'Aucune donnée joueur disponible — générer une analyse générique.';

            const homeScore = event.homeScore ?? 0;
            const awayScore = event.awayScore ?? 0;
            const opponent = event.opponentName || 'Adversaire';
            const competition = (event as any).competition || 'Championnat';
            const duration = event.matchDuration || 90;

            const prompt = `Tu es analyste sportif pour ODIN ERP Club. Génère un compte-rendu de match professionnel en français.

RÉSULTAT: ODIN FC ${homeScore} - ${awayScore} ${opponent}
COMPÉTITION: ${competition}
DURÉE: ${duration}'

STATISTIQUES ÉQUIPE:
- Buts: ${teamStats.goals}, Tirs cadrés: ${teamStats.shots}
- Possession: ${teamStats.possession}%, Passes réussies: ${teamStats.passAccuracy}%
- Meilleur joueur: ${mvpPlayer?.participantName || 'N/A'} (note ${mvpPlayer?.rating || 0}/10)

PERFORMANCES JOUEURS:
${playersInfo}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après, sans balises markdown. Format exact:
{"summary":"résumé 3-4 phrases","mvp":{"name":"prénom joueur","reason":"justification"},"strengths":["point fort 1","point fort 2"],"improvements":["à améliorer 1","à améliorer 2"],"motivationalNote":"phrase motivation"}`;

            this.logger.log(`[AI Debrief] ✓ Prompt built (${prompt.length} chars)`);

            const fallbackDebrief = {
                summary: `Analyse générée automatiquement: Le match contre ${opponent} s'est soldé par un score de ${homeScore} - ${awayScore}. L'équipe a enregistré ${teamStats.goals} buts et ${teamStats.shots} tirs cadrés avec une note moyenne globale de ${teamStats.avgRating}/10.`,
                mvp: {
                    name: mvpPlayer?.participantName || 'Aucun',
                    reason: mvpPlayer ? `Excellente performance avec une note de ${mvpPlayer.rating}/10.` : 'Bel effort collectif sur ce match.'
                },
                strengths: ['Engagement et effort collectif', `Possession (${teamStats.possession}%)`],
                improvements: ['Maintenir la régularité', 'Efficacité dans les zones de vérité'],
                motivationalNote: 'Chaque match est une leçon, continuons à travailler dur à l\'entraînement !'
            };

            let debriefToSave = fallbackDebrief;
            let apiSuccess = false;

            // 1. Try Gemini
            if (apiKey) {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                this.logger.log(`[AI Debrief] ▶ Calling Gemini API at: ${url.split('?')[0]}`);

                try {
                    const response = await firstValueFrom(
                        this.httpService.post(url, {
                            contents: [{ role: 'user', parts: [{ text: prompt }] }],
                            generationConfig: { 
                                temperature: 0.7,
                                maxOutputTokens: 1200,
                            },
                        }, { timeout: 15000 })
                    );
                    
                    let rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    rawText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

                    try {
                        const parsed = JSON.parse(rawText);
                        debriefToSave = parsed;
                        apiSuccess = true;
                        this.logger.log(`[AI Debrief] ✓ Gemini API success`);
                    } catch (e) {}
                } catch (httpErr: any) {
                    this.logger.error(`[AI Debrief] ✗ Gemini API failed: ${httpErr?.response?.status || httpErr.message}`);
                }
            }

            // 2. Try Groq if Gemini failed or wasn't configured
            if (!apiSuccess && groqApiKey) {
                this.logger.log(`[AI Debrief] ▶ Calling Groq API (llama-3.3-70b-versatile)...`);
                try {
                    const groqResponse = await firstValueFrom(
                        this.httpService.post('https://api.groq.com/openai/v1/chat/completions', {
                            model: 'llama-3.3-70b-versatile',
                            messages: [{ role: 'user', content: prompt }],
                            temperature: 0.7,
                            max_tokens: 1200,
                            response_format: { type: 'json_object' }
                        }, {
                            headers: {
                                'Authorization': `Bearer ${groqApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 15000
                        })
                    );
                    
                    const rawText = groqResponse.data?.choices?.[0]?.message?.content || '';
                    try {
                        const parsed = JSON.parse(rawText);
                        debriefToSave = parsed;
                        apiSuccess = true;
                        this.logger.log(`[AI Debrief] ✓ Groq API success`);
                    } catch (e) {}
                } catch (groqErr: any) {
                    this.logger.error(`[AI Debrief] ✗ Groq API failed: ${groqErr?.response?.status || groqErr.message}`);
                }
            }
            
            if (!apiSuccess) {
                this.logger.log(`[AI Debrief] ⚠ All AI APIs failed or skipped, using fallback debrief.`);
            }

            try {
                const updatedEvent = await this.eventModel.findById(eventId).exec();
                const currentSummary = updatedEvent?.matchSummary || {};

                await this.eventModel.findByIdAndUpdate(eventId, { 
                    aiDebrief: debriefToSave,
                    matchSummary: { ...currentSummary, ...teamStats }
                }).exec();
                this.logger.log(`[AI Debrief] ✅ Debrief saved to database for event ${eventId}`);
            } catch (saveErr: any) {
                 this.logger.error(`[AI Debrief] ✗ DB save failed: ${saveErr.message}`);
            }

        } catch (err: any) {
            this.logger.error(`[AI Debrief] ✗ Unexpected error: ${err.message}`);
            this.logger.error(`[AI Debrief] Stack: ${err.stack}`);
            
            // Final failsafe
            try {
                await this.eventModel.findByIdAndUpdate(eventId, { 
                    aiDebrief: { summary: "Analyse automatique temporairement indisponible." } 
                }).exec();
            } catch (e) {}
        }
        this.logger.log(`[AI Debrief] ■ Finished for event ${eventId}`);
    }


    // ═══════════════════════════════════════════════════════════════════════════
    // WEATHER (OpenWeatherMap)
    // ═══════════════════════════════════════════════════════════════════════════

    async getWeatherPreview(location: string): Promise<any> {
        const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
        
        if (!apiKey) {
            this.logger.warn('OPENWEATHER_API_KEY non configurée. Retour d\'une météo fictive pour démonstration.');
            return {
                success: true,
                data: {
                    condition: 'Ensoleillé',
                    description: 'Ciel dégagé',
                    tempCelsius: 22,
                    windKmh: 15,
                    icon: '01d',
                    fetchedAt: new Date(),
                }
            };
        }

        this.logger.log(`Weather preview requested for: ${location}`);

        try {
            // Priority 1: Direct location search
            let geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`;
            let geoResp = await firstValueFrom(this.httpService.get(geoUrl));
            let geoData = geoResp.data;

            // Fallback: If stadium fails, try just the city/country part (split by comma)
            if ((!geoData || geoData.length === 0) && location.includes(',')) {
                const parts = location.split(',');
                const fallbackLoc = parts[parts.length - 1].trim(); // Take the country/city part
                this.logger.log(`Direct geo failed, trying fallback: ${fallbackLoc}`);
                geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(fallbackLoc)}&limit=1&appid=${apiKey}`;
                geoResp = await firstValueFrom(this.httpService.get(geoUrl));
                geoData = geoResp.data;
            }

            if (!geoData || geoData.length === 0) {
                this.logger.warn(`No geocoding results for ${location}. Retour d'une météo par défaut.`);
                return {
                    success: true,
                    data: {
                        condition: 'Partiellement Nuageux',
                        description: 'Quelques nuages',
                        tempCelsius: 18,
                        windKmh: 10,
                        icon: '03d',
                        fetchedAt: new Date(),
                    }
                };
            }

            const { lat, lon } = geoData[0];
            const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=fr`;
            const weatherResp = await firstValueFrom(this.httpService.get(weatherUrl));
            const data = weatherResp.data;

            return {
                success: true,
                data: {
                    condition: data.weather?.[0]?.main ?? 'Inconnu',
                    description: data.weather?.[0]?.description ?? '',
                    tempCelsius: Math.round(data.main?.temp ?? 0),
                    windKmh: Math.round((data.wind?.speed ?? 0) * 3.6),
                    icon: data.weather?.[0]?.icon ?? '',
                    fetchedAt: new Date(),
                }
            };
        } catch (err: any) {
            this.logger.error(`Weather preview error: ${err.message}. Retour d'une météo par défaut.`);
            return {
                success: true,
                data: {
                    condition: 'Indisponible',
                    description: 'Service météo hors ligne',
                    tempCelsius: 0,
                    windKmh: 0,
                    icon: '50d',
                    fetchedAt: new Date(),
                }
            };
        }
    }

    private async attachLogisticsData(eventId: string, clubId: string, eventLocation: string, matchDate: Date): Promise<void> {
        if (!eventLocation) return;

        try {
            const club = await this.clubsService.findOne(clubId);
            const c = club as any;
            if (!c || !c.address) {
                this.logger.warn(`Cannot calculate logistics: Club ${clubId} has no address`);
                return;
            }

            const homeAddress = `${c.address}, ${c.city}, ${c.country}`;
            this.logger.log(`Calculating logistics from ${homeAddress} to ${eventLocation}`);

            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            const startCoords = await this.locationService.geocode(homeAddress);
            await sleep(1100); // Respect LocationIQ 1 req/sec limit
            const endCoords = await this.locationService.geocode(eventLocation);
            await sleep(1100); // Respect LocationIQ 1 req/sec limit

            if (!startCoords || !endCoords) {
                this.logger.warn(`Geocoding failed for logistics between ${homeAddress} and ${eventLocation}`);
                return;
            }

            const route = await this.locationService.getRoute(startCoords, endCoords);
            if (!route) return;

            // Suggested Departure Time: Match Start - Travel Time - 90 Minutes (5400 seconds)
            const bufferSeconds = 5400; 
            const departureTime = new Date(matchDate.getTime() - (route.durationSeconds * 1000) - (bufferSeconds * 1000));

            const logistics = {
                travelTimeSeconds: route.durationSeconds,
                departureTime,
                distanceKm: Math.round(route.distanceMeters / 1000 * 10) / 10,
                itineraryUrl: route.itineraryUrl,
                startAddress: homeAddress,
                polyline: route.polyline,
                lat: endCoords.lat,
                lon: endCoords.lon,
                calculatedAt: new Date(),
            };

            await this.eventModel.findByIdAndUpdate(eventId, { logistics }).exec();
            this.logger.log(`Logistics attached to event ${eventId}: ${logistics.distanceKm}km, Travel ${Math.round(logistics.travelTimeSeconds/60)}min, Departure ${logistics.departureTime.toISOString()}`);

        } catch (err: any) {
            this.logger.error(`Failed to attach logistics to event ${eventId}: ${err.message}`);
        }
    }

    private async fetchAndAttachWeather(eventId: string, location: string, date: Date): Promise<void> {
        const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
        
        let weather;
        if (!apiKey) {
            this.logger.warn('OPENWEATHER_API_KEY non configurée. Attachement d\'une météo fictive.');
            weather = {
                condition: 'Ensoleillé',
                tempCelsius: 22,
                windKmh: 15,
                icon: '01d',
                fetchedAt: new Date(),
            };
        } else {
            try {
                // Geocode location → lat/lon
                const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`;
                const geoResp = await firstValueFrom(this.httpService.get(geoUrl));
                const geoData = geoResp.data;
                
                if (geoData && geoData.length > 0) {
                    const { lat, lon } = geoData[0];
                    const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=fr`;
                    const weatherResp = await firstValueFrom(this.httpService.get(weatherUrl));
                    const forecast = weatherResp.data?.list;
                    
                    if (forecast) {
                        const eventTime = date.getTime();
                        const closest = forecast.reduce((prev: any, curr: any) => {
                            return Math.abs(curr.dt * 1000 - eventTime) < Math.abs(prev.dt * 1000 - eventTime) ? curr : prev;
                        });
                        
                        weather = {
                            condition: closest.weather?.[0]?.description ?? closest.weather?.[0]?.main ?? 'Inconnu',
                            tempCelsius: Math.round(closest.main?.temp ?? 0),
                            windKmh: Math.round((closest.wind?.speed ?? 0) * 3.6),
                            icon: closest.weather?.[0]?.icon ?? '',
                            fetchedAt: new Date(),
                        };
                    }
                }

                if (!weather) {
                    this.logger.warn(`No geocoding or forecast results for location: ${location}. Using fallback weather.`);
                    weather = {
                        condition: 'Partiellement Nuageux',
                        tempCelsius: 18,
                        windKmh: 10,
                        icon: '03d',
                        fetchedAt: new Date(),
                    };
                }
            } catch (err: any) {
                this.logger.error(`Failed to fetch weather for event ${eventId}: ${err.message}`);
                // Fallback to mock on error
                weather = {
                    condition: 'Partiellement Nuageux',
                    tempCelsius: 18,
                    windKmh: 10,
                    icon: '03d',
                    fetchedAt: new Date(),
                };
            }
        }

        if (weather) {
            await this.eventModel.findByIdAndUpdate(eventId, { weather }).exec();
            this.logger.log(`[Weather] ✅ Attached to event ${eventId}: ${weather.condition} ${weather.tempCelsius}°C`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CRON — called by EventsScheduler
    // ═══════════════════════════════════════════════════════════════════════════

    async sendPendingReminders(): Promise<void> {
        const now = new Date();

        // J-1 reminder (events tomorrow)
        const tomorrowStart = new Date(now);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        tomorrowStart.setHours(0, 0, 0, 0);
        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setHours(23, 59, 59, 999);

        const tomorrowEvents = await this.eventModel.find({
            startDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
            reminderEnabled: true,
            reminderDayBeforeSent: false,
            status: EventStatus.SCHEDULED,
        }).exec();

        for (const event of tomorrowEvents) {
            await this.sendReminderToParticipants(event, 'tomorrow');
            await this.eventModel.findByIdAndUpdate(event._id, { reminderDayBeforeSent: true }).exec();
        }

        // 2h before reminder
        const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const windowStart = new Date(twoHoursLater.getTime() - 5 * 60 * 1000);   // ±5min window
        const windowEnd   = new Date(twoHoursLater.getTime() + 5 * 60 * 1000);

        const soonEvents = await this.eventModel.find({
            startDate: { $gte: windowStart, $lte: windowEnd },
            reminderEnabled: true,
            reminderTwoHourSent: false,
            status: EventStatus.SCHEDULED,
        }).exec();

        for (const event of soonEvents) {
            await this.sendReminderToParticipants(event, '2h');
            await this.eventModel.findByIdAndUpdate(event._id, { reminderTwoHourSent: true }).exec();
        }
    }

    private async sendReminderToParticipants(event: ErpEventDocument, timing: 'tomorrow' | '2h'): Promise<void> {
        const participants = await this.participantModel.find({
            eventId: String(event._id),
            status: { $in: [ParticipationStatus.INVITED, ParticipationStatus.CONFIRMED] },
        }).exec();

        const userIds = participants.map(p => p.participantId);
        const users = await this.userModel.find({ _id: { $in: userIds } }).exec();
        const tokens = users.map(u => u.fcmToken).filter(Boolean);

        const title = timing === 'tomorrow'
            ? `📅 Rappel : ${event.title} demain`
            : `⏰ Rappel : ${event.title} dans 2h`;
        const body = `${event.startDate.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${event.location ? ' — ' + event.location : ''}`;

        if (tokens.length > 0) {
            await this.fcmService.sendToTokens(tokens, title, body, {
                type: 'event_reminder',
                eventId: String(event._id),
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    private async notifyClubUsers(
        clubId: string,
        payload: { title: string; message: string; notificationType: NotificationType; relatedEntityType?: string; relatedEntityId?: string },
    ): Promise<void> {
        const users = await this.userModel.find({ clubId }).exec();
        const notifications = users.map(user => ({
            clubId: new Types.ObjectId(clubId),
            recipientUserId: user.id,
            title: payload.title,
            body: payload.message,
            type: payload.notificationType,
            data: {
              relatedEntityType: payload.relatedEntityType,
              relatedEntityId: payload.relatedEntityId,
            },
            status: NotificationStatus.UNREAD,
        }));
        if (notifications.length > 0) await this.notificationModel.insertMany(notifications);

        // FCM push to all club members
        const tokens = users.map(u => u.fcmToken).filter(Boolean);
        if (tokens.length > 0) {
            await this.fcmService.sendToTokens(tokens, payload.title, payload.message, {
                type: payload.notificationType,
                relatedEntityId: payload.relatedEntityId ?? '',
            });
        }
    }

    private async notifyErpEventParticipants(
        eventId: string,
        payload: { title: string; message: string; notificationType: NotificationType; relatedEntityType?: string; relatedEntityId?: string },
    ): Promise<void> {
        const participants = await this.participantModel.find({ eventId }).exec();
        if (participants.length === 0) return;

        const event = await this.eventModel.findById(eventId).exec();
        if (!event) return;

        const notifications = participants.map(p => ({
            clubId: event.clubId,
            recipientUserId: p.participantId,
            title: payload.title,
            body: payload.message,
            type: payload.notificationType,
            data: {
              relatedEntityType: payload.relatedEntityType,
              relatedEntityId: payload.relatedEntityId,
            },
            status: NotificationStatus.UNREAD,
        }));
        if (notifications.length > 0) await this.notificationModel.insertMany(notifications);

        const userIds = participants.map(p => p.participantId);
        const users = await this.userModel.find({ _id: { $in: userIds } }).exec();
        const tokens = users.map(u => u.fcmToken).filter(Boolean);
        if (tokens.length > 0) {
            await this.fcmService.sendToTokens(tokens, payload.title, payload.message);
        }
    }

    /** Only notify participants who were actually convocated (status != absent / not-invited) */
    private async notifyConvocatedPlayers(
        eventId: string,
        payload: { title: string; message: string; notificationType: NotificationType; relatedEntityType?: string; relatedEntityId?: string },
    ): Promise<void> {
        const participants = await this.participantModel.find({
            eventId,
            status: { $in: [ParticipationStatus.INVITED, ParticipationStatus.CONFIRMED] },
        }).exec();

        if (participants.length === 0) return;

        const event = await this.eventModel.findById(eventId).exec();
        if (!event) return;

        const notifications = participants.map(p => ({
            clubId: event.clubId,
            recipientUserId: p.participantId,
            title: payload.title,
            body: payload.message,
            type: payload.notificationType,
            data: {
              relatedEntityType: payload.relatedEntityType,
              relatedEntityId: payload.relatedEntityId,
            },
            status: NotificationStatus.UNREAD,
        }));
        await this.notificationModel.insertMany(notifications);

        const userIds = participants.map(p => p.participantId);
        const users = await this.userModel.find({ _id: { $in: userIds } }).exec();
        const tokens = users.map(u => u.fcmToken).filter(Boolean);
        if (tokens.length > 0) {
            await this.fcmService.sendToTokens(tokens, payload.title, payload.message, {
                type: payload.notificationType,
                relatedEntityId: payload.relatedEntityId ?? '',
            });
        }
    }

    async getTeamStats(eventId: string, clubId: string) {
        const event = await this.eventModel.findById(eventId).exec();
        if (!event) throw new Error('Event not found');

        const participants = await this.participantModel.find({ eventId }).exec();
        const playedPlayers = participants.filter(p => p.played);

        if (playedPlayers.length === 0) {
            return {
                offensive: { goals: 0, assists: 0, shotsOnTarget: 0 },
                defensive: { tackles: 0, interceptions: 0, cleanSheet: false },
                squad: { avgRating: 0, mvp: null, totalMinutes: 0 },
            };
        }

        // Offensive
        const totalGoals = playedPlayers.reduce((sum, p) => sum + (p.goals || 0), 0);
        const totalAssists = playedPlayers.reduce((sum, p) => sum + (p.assists || 0), 0);
        const totalShots = playedPlayers.reduce((sum, p) => sum + (p.shotsOnTarget || 0), 0);
        
        const topScorer = playedPlayers.length > 0 
            ? playedPlayers.reduce((prev, current) => ((prev.goals || 0) > (current.goals || 0)) ? prev : current)
            : null;

        const bestAssister = playedPlayers.length > 0 
            ? playedPlayers.reduce((prev, current) => ((prev.assists || 0) > (current.assists || 0)) ? prev : current)
            : null;

        // Defensive
        const totalTackles = playedPlayers.reduce((sum, p) => sum + (p.tackles || 0), 0);
        const totalInterceptions = playedPlayers.reduce((sum, p) => sum + (p.interceptions || 0), 0);
        const cleanSheet = event.awayScore === 0;

        // Squad
        const avgRating = playedPlayers.reduce((sum, p) => sum + (p.rating || 0), 0) / playedPlayers.length;
        const mvp = playedPlayers.reduce((prev, current) => ((prev.rating || 0) > (current.rating || 0)) ? prev : current);
        const totalMinutes = playedPlayers.reduce((sum, p) => sum + (p.minutesPlayed || 0), 0);
        
        const fullGamePlayers = playedPlayers.filter(p => p.minutesPlayed >= (event.matchDuration || 90));
        const subbedOut = playedPlayers.filter(p => p.isStarter && p.minuteOut != null);
        const subbedIn = playedPlayers.filter(p => !p.isStarter && p.played);

        return {
            offensive: {
                goals: totalGoals,
                assists: totalAssists,
                shotsOnTarget: totalShots,
                topScorer: topScorer && topScorer.goals > 0 ? { name: topScorer.participantName || 'Joueur', goals: topScorer.goals } : null,
                bestAssister: bestAssister && bestAssister.assists > 0 ? { name: bestAssister.participantName || 'Joueur', assists: bestAssister.assists } : null,
            },
            defensive: {
                tackles: totalTackles,
                interceptions: totalInterceptions,
                cleanSheet: !!cleanSheet,
            },
            squad: {
                avgRating: avgRating.toFixed(1),
                mvp: mvp ? { name: mvp.participantName || 'Joueur', rating: mvp.rating } : null,
                totalMinutes,
                playerCount: playedPlayers.length,
                fullGameCount: fullGamePlayers.length,
                fullGamePlayers: fullGamePlayers.map(p => p.participantName || 'Joueur'),
                subOutCount: subbedOut.length,
                subInCount: subbedIn.length,
            },
            performance: {
                possession: event.matchSummary?.possession ?? 50,
                passAccuracy: event.matchSummary?.passAccuracy ?? 70,
                corners: event.matchSummary?.corners ?? 0,
                foulsCommitted: event.matchSummary?.foulsCommitted ?? 0,
                foulsReceived: event.matchSummary?.foulsReceived ?? 0,
            }
        };
    }

    async updateMatchSummary(eventId: string, clubId: string, summaryData: any) {
        const event = await this.findOne(eventId, clubId) as ErpEventDocument;
        const currentSummary = event.matchSummary || {};
        
        await this.eventModel.findByIdAndUpdate(eventId, {
            matchSummary: {
                ...currentSummary,
                ...summaryData,
                lastManualUpdate: new Date(),
            }
        }).exec();
        
        return { success: true };
    }

    private async sendRatingNotifications(eventId: string) {
        try {
            const event = await this.eventModel.findById(eventId).exec();
            if (!event) return;

            const stats = await this.participantModel.find({ eventId }).exec();

            for (const stat of stats) {
                if (!stat.rating && !stat.publicNote) continue;
                if (stat.notificationSent) continue;

                const user = await this.userModel.findById(stat.participantId).exec();
                if (!user || !user.fcmToken) continue;

                const message = stat.rating 
                    ? `Tu as reçu une note de ${stat.rating}/10 pour le match ${event.title}`
                    : `Ton coach a laissé un commentaire sur ta performance pour ${event.title}`;

                await this.fcmService.sendToTokens([user.fcmToken], `⭐ Ta note — ${event.title}`, message, {
                    type: 'MATCH_RATING',
                    relatedEntityId: eventId,
                });

                await this.participantModel.findByIdAndUpdate(stat._id, { notificationSent: true }).exec();
            }
        } catch (err: any) {
            this.logger.error(`Failed to send rating notifications: ${err.message}`);
        }
    }
}

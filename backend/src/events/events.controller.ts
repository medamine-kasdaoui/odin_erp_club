import {
    Controller, Get, Post, Put, Delete, Patch, Body, Param,
    Query, UseGuards, Request,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { SendConvocationsDto } from './dto/send-convocations.dto';
import { RespondConvocationDto } from './dto/respond-convocation.dto';
import { SaveMatchSheetDto } from './dto/save-match-sheet.dto';
import { AddLiveEventDto } from './dto/add-live-event.dto';
import { SetMatchResultDto } from './dto/set-match-result.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventStatus } from './schemas/event.schema';
import { ParticipationStatus } from './schemas/event-participant.schema';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    /** GET /events/weather-preview — prévisualisation météo avant création */
    @Get('weather-preview')
    async getWeatherPreview(@Query('location') location: string) {
        return this.eventsService.getWeatherPreview(location);
    }

    /** GET /events/my-invitations — convocations en attente pour le joueur connecté */
    @Get('my-invitations')
    async getMyInvitations(@Request() req) {
        return this.eventsService.getMyInvitations(req.user.sub, req.user.clubId);
    }

    // ─── Events CRUD ──────────────────────────────────────────────────────────

    @Get()
    findAll(
        @Request() req,
        @Query('clubId') clubId?: string,
        @Query('eventType') eventType?: string,
        @Query('teamId') teamId?: string,
        @Query('status') status?: EventStatus,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const targetClubId = clubId || req.user.clubId;
        return this.eventsService.findAll(targetClubId, {
            eventType, teamId, status, startDate, endDate,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 50,
        });
    }

    @Get('calendar')
    async getCalendar(
        @Request() req,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('teamId') teamId?: string,
        @Query('clubId') clubId?: string,
    ) {
        const targetClubId = clubId || req.user.clubId;
        return this.eventsService.getCalendar(targetClubId, startDate, endDate, teamId);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.eventsService.findOne(id, req.user.clubId);
    }

    @Post()
    async create(@Body() createEventDto: CreateEventDto, @Request() req) {
        if (!createEventDto.clubId) createEventDto.clubId = req.user.clubId;
        return this.eventsService.create(createEventDto, req.user.sub);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto, @Request() req) {
        return this.eventsService.update(id, req.user.clubId, updateEventDto, req.user.sub);
    }

    @Patch(':id/status')
    updateStatus(@Param('id') id: string, @Body() dto: UpdateEventStatusDto, @Request() req) {
        return this.eventsService.updateStatus(id, req.user.clubId, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.eventsService.remove(id, req.user.clubId);
    }

    // ─── Participants (legacy) ────────────────────────────────────────────────

    @Get(':id/participants')
    getParticipants(@Param('id') id: string, @Request() req: any) {
        return this.eventsService.getParticipants(id, req.user.clubId, req.user.sub);
    }

    @Get(':id/team-stats')
    async getTeamStats(@Param('id') id: string, @Request() req: any) {
        return this.eventsService.getTeamStats(id, req.user.clubId);
    }

    @Patch(':id/team-stats')
    async updateTeamStats(@Param('id') id: string, @Body() body: any, @Request() req: any) {
        return this.eventsService.updateMatchSummary(id, req.user.clubId, body);
    }

    @Post(':id/participants')
    addParticipant(@Param('id') eventId: string, @Body() dto: AddParticipantDto, @Request() req) {
        return this.eventsService.addParticipant(eventId, req.user.clubId, dto);
    }

    @Patch(':eventId/participants/:participantId/status')
    updateParticipantStatus(
        @Param('eventId') eventId: string,
        @Param('participantId') participantId: string,
        @Body('status') status: ParticipationStatus,
        @Request() req,
    ) {
        return this.eventsService.updateParticipantStatus(eventId, req.user.clubId, participantId, status);
    }

    @Delete(':eventId/participants/:participantId')
    removeParticipant(
        @Param('eventId') eventId: string,
        @Param('participantId') participantId: string,
        @Request() req,
    ) {
        return this.eventsService.removeParticipant(eventId, req.user.clubId, participantId);
    }

    // ─── Convocations ─────────────────────────────────────────────────────────

    /** POST /events/:id/convocations — coach envoie les convocations */
    @Post(':id/convocations')
    sendConvocations(
        @Param('id') eventId: string,
        @Body() dto: SendConvocationsDto,
        @Request() req,
    ) {
        return this.eventsService.sendConvocations(eventId, req.user.clubId, dto, req.user.sub);
    }

    /** PATCH /events/:id/convocations/:participantId/respond — joueur répond */
    @Patch(':id/convocations/:participantId/respond')
    respondToConvocation(
        @Param('id') eventId: string,
        @Param('participantId') participantId: string,
        @Body() dto: RespondConvocationDto,
        @Request() req,
    ) {
        return this.eventsService.respondToConvocation(eventId, participantId, dto, req.user.clubId);
    }

    /** PATCH /events/:id/bulk-player-stats — coach saisit les stats de tous les joueurs */
    @Patch(':id/bulk-player-stats')
    saveBulkPlayerStats(
        @Param('id') eventId: string,
        @Body() body: { stats: any[] },
        @Request() req,
    ) {
        return this.eventsService.saveBulkPlayerStats(eventId, req.user.clubId, body.stats);
    }

    /** GET /events/:id/presence-report — taux de confirmation */
    @Get(':id/presence-report')
    getPresenceReport(@Param('id') id: string, @Request() req) {
        return this.eventsService.getPresenceReport(id, req.user.clubId);
    }

    // ─── Match Sheet ──────────────────────────────────────────────────────────

    /** GET /events/:id/match-sheet */
    @Get(':id/match-sheet')
    getMatchSheet(@Param('id') id: string, @Request() req) {
        return this.eventsService.getMatchSheet(id, req.user.clubId);
    }

    /** PATCH /events/:id/match-sheet */
    @Patch(':id/match-sheet')
    saveMatchSheet(
        @Param('id') eventId: string,
        @Body() dto: SaveMatchSheetDto,
        @Request() req,
    ) {
        return this.eventsService.saveMatchSheet(eventId, req.user.clubId, dto, req.user.sub);
    }

    // ─── Live Match Events ────────────────────────────────────────────────────

    /** GET /events/:id/live-events — timeline live */
    @Get(':id/live-events')
    getLiveEvents(@Param('id') id: string, @Request() req) {
        return this.eventsService.getLiveEvents(id, req.user.clubId);
    }

    /** POST /events/:id/live-events — ajouter but/carton/remplacement… */
    @Post(':id/live-events')
    addLiveEvent(
        @Param('id') eventId: string,
        @Body() dto: AddLiveEventDto,
        @Request() req,
    ) {
        return this.eventsService.addLiveEvent(eventId, req.user.clubId, dto, req.user.sub);
    }

    // ─── Match Result ─────────────────────────────────────────────────────────

    /** PATCH /events/:id/result — saisie score final + stats */
    @Patch(':id/result')
    setMatchResult(
        @Param('id') eventId: string,
        @Body() dto: SetMatchResultDto,
        @Request() req,
    ) {
        return this.eventsService.setMatchResult(eventId, req.user.clubId, dto);
    }
}

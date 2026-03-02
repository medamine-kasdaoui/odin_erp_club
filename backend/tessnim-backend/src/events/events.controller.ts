import {
    Controller, Get, Post, Put, Delete, Patch, Body, Param,
    Query, UseGuards, Request,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventStatus } from './entities/event.entity';
import { ParticipationStatus } from './entities/event-participant.entity';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
    constructor(private readonly eventsService: EventsService) { }

    // ─── Events CRUD ───────────────────────────────────────────────

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
            eventType,
            teamId,
            status,
            startDate,
            endDate,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 50,
        });
    }

    /**
     * Calendar view — group events by date
     * GET /api/v1/events/calendar?startDate=2026-02-01&endDate=2026-02-28
     */
    @Get('calendar')
    async getCalendar(
        @Request() req,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('teamId') teamId?: string,
        @Query('clubId') clubId?: string,
    ) {
        const targetClubId = clubId || req.user.clubId;
        console.log(`--- GET CALENDAR REQ: ${startDate} to ${endDate} ---`);
        const result = await this.eventsService.getCalendar(targetClubId, startDate, endDate, teamId);
        console.log(`Calendar response generated. Calendar dates count: ${Object.keys(result.data.calendar).length}`);
        return result;
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.eventsService.findOne(id, req.user.clubId);
    }

    @Post()
    async create(@Body() createEventDto: CreateEventDto, @Request() req) {
        console.log('--- INCOMING EVENT CREATION PAYLOAD ---');
        console.log(JSON.stringify(createEventDto, null, 2));

        try {
            if (!createEventDto.clubId) {
                createEventDto.clubId = req.user.clubId;
            }
            const result = await this.eventsService.create(createEventDto, req.user.userId);
            console.log('Event successfully created:', result.id);
            return result;
        } catch (error) {
            console.error('--- EVENT CREATION FAILED ---');
            console.error(error.message);
            console.error(error.response || error);
            throw error;
        }
    }

    @Put(':id')
    update(
        @Param('id') id: string,
        @Body() updateEventDto: UpdateEventDto,
        @Request() req,
    ) {
        return this.eventsService.update(id, req.user.clubId, updateEventDto, req.user.userId);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateEventStatusDto,
        @Request() req,
    ) {
        return this.eventsService.updateStatus(id, req.user.clubId, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.eventsService.remove(id, req.user.clubId);
    }

    // ─── Participants ───────────────────────────────────────────────

    @Get(':id/participants')
    getParticipants(@Param('id') id: string, @Request() req) {
        return this.eventsService.getParticipants(id, req.user.clubId);
    }

    addParticipant(
        @Param('id') eventId: string,
        @Body() dto: AddParticipantDto,
        @Request() req,
    ) {
        return this.eventsService.addParticipant(eventId, req.user.clubId, dto);
    }

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
}

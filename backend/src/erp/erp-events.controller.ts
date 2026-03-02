import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { ErpEventsService } from './erp-events.service';
import { clubIdFromUser, toObjectId } from './erp-utils';

@Controller('erp/events')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ErpEventsController {
  constructor(private readonly service: ErpEventsService) {}

  @Get()
  findAll(
    @Request() req,
    @Query('eventType') eventType?: string,
    @Query('teamId') teamId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const clubId = clubIdFromUser(req.user);
    return this.service.findAll(clubId, {
      eventType,
      teamId,
      status,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50
    });
  }

  @Get('calendar')
  getCalendar(
    @Request() req,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('teamId') teamId?: string
  ) {
    const clubId = clubIdFromUser(req.user);
    return this.service.getCalendar(clubId, startDate, endDate, teamId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.findOne(id, clubId);
  }

  @Post()
  create(@Body() body: Record<string, unknown>, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    const createdBy = toObjectId(req.user?.sub, 'userId');
    return this.service.create(clubId, body, createdBy);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    const updatedBy = toObjectId(req.user?.sub, 'userId');
    return this.service.update(id, clubId, body, updatedBy);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Request() req
  ) {
    const clubId = clubIdFromUser(req.user);
    return this.service.updateStatus(id, clubId, body.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.remove(id, clubId);
  }

  @Get(':id/participants')
  getParticipants(@Param('id') id: string, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.getParticipants(id, clubId);
  }

  @Post(':id/participants')
  addParticipant(
    @Param('id') id: string,
    @Body() body: { participantType: string; participantId: string; notes?: string },
    @Request() req
  ) {
    const clubId = clubIdFromUser(req.user);
    return this.service.addParticipant(id, clubId, body);
  }

  @Patch(':eventId/participants/:participantId')
  updateParticipantStatus(
    @Param('eventId') eventId: string,
    @Param('participantId') participantId: string,
    @Body('status') status: string,
    @Request() req
  ) {
    const clubId = clubIdFromUser(req.user);
    return this.service.updateParticipantStatus(eventId, clubId, participantId, status);
  }

  @Delete(':eventId/participants/:participantId')
  removeParticipant(
    @Param('eventId') eventId: string,
    @Param('participantId') participantId: string,
    @Request() req
  ) {
    const clubId = clubIdFromUser(req.user);
    return this.service.removeParticipant(eventId, clubId, participantId);
  }
}

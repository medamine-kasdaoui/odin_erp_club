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
import { ErpPlayersService } from './erp-players.service';
import { clubIdFromUser, toObjectId } from './erp-utils';

@Controller('erp/players')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ErpPlayersController {
  constructor(private readonly service: ErpPlayersService) {}

  @Get()
  findAll(
    @Request() req,
    @Query('status') status?: string,
    @Query('teamId') teamId?: string,
    @Query('position') position?: string,
    @Query('isProspect') isProspect?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const clubId = clubIdFromUser(req.user);
    return this.service.findAll(clubId, {
      status,
      teamId,
      position,
      isProspect,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20
    });
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
  update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Request() req
  ) {
    const clubId = clubIdFromUser(req.user);
    const updatedBy = toObjectId(req.user?.sub, 'userId');
    return this.service.update(id, clubId, body, updatedBy);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.remove(id, clubId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; description?: string; returnDate?: string },
    @Request() req
  ) {
    const clubId = clubIdFromUser(req.user);
    const updatedBy = toObjectId(req.user?.sub, 'userId');
    return this.service.updateStatus(
      id,
      clubId,
      body.status,
      body.description,
      body.returnDate,
      updatedBy
    );
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.getHistory(id, clubId);
  }

  @Post(':id/assign-team')
  assignTeam(
    @Param('id') id: string,
    @Body() body: { teamId: string },
    @Request() req
  ) {
    const clubId = clubIdFromUser(req.user);
    const updatedBy = toObjectId(req.user?.sub, 'userId');
    return this.service.assignTeam(id, clubId, body.teamId, updatedBy);
  }
}

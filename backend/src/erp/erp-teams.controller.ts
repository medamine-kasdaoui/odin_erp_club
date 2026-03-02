import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { ErpTeamsService } from './erp-teams.service';
import { clubIdFromUser } from './erp-utils';

@Controller('erp/teams')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ErpTeamsController {
  constructor(private readonly service: ErpTeamsService) {}

  @Get()
  findAll(@Request() req, @Query('categoryId') categoryId?: string) {
    const clubId = clubIdFromUser(req.user);
    return this.service.findAll(clubId, categoryId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.findOne(id, clubId);
  }

  @Post()
  create(@Body() body: Record<string, unknown>, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.create(clubId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.remove(id, clubId);
  }
}

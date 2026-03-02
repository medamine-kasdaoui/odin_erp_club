import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { ErpStaffService } from './erp-staff.service';
import { clubIdFromUser, toObjectId } from './erp-utils';

@Controller('erp/staff')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ErpStaffController {
  constructor(private readonly service: ErpStaffService) {}

  @Get()
  findAll(
    @Request() req,
    @Query('role') role?: string,
    @Query('teamId') teamId?: string,
    @Query('status') status?: string
  ) {
    const clubId = clubIdFromUser(req.user);
    return this.service.findAll(clubId, { role, teamId, status });
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
    return this.service.update(id, clubId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.remove(id, clubId);
  }
}

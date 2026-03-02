import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { ErpCategoriesService } from './erp-categories.service';
import { clubIdFromUser } from './erp-utils';

@Controller('erp/categories')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ErpCategoriesController {
  constructor(private readonly service: ErpCategoriesService) {}

  @Get()
  findAll(@Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.findAll(clubId);
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

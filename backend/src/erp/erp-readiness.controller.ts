import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { ErpReadinessService } from './erp-readiness.service';
import { ErpPlayerMetricsDto, ErpSquadMetricsDto } from './dto/erp-player-metrics.dto';
import { clubIdFromUser } from './erp-utils';

@Controller('erp/ai/readiness')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class ErpReadinessController {
  constructor(private readonly service: ErpReadinessService) {}

  @Post()
  analyzePlayer(@Body() dto: ErpPlayerMetricsDto, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.analyzePlayer(dto, clubId);
  }

  @Post('squad')
  async analyzeSquad(@Body() body: ErpSquadMetricsDto, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    const results: any[] = [];
    for (const player of body.players) {
      player.matchDate = body.matchDate;
      const result = await this.service.analyzePlayer(player, clubId);
      results.push(result);
    }
    return { results };
  }

  @Get(':matchDate')
  getCached(@Param('matchDate') matchDate: string, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.getCachedResults(clubId, matchDate);
  }

  @Delete(':matchDate')
  clearResults(@Param('matchDate') matchDate: string, @Request() req) {
    const clubId = clubIdFromUser(req.user);
    return this.service.clearResults(clubId, matchDate);
  }
}

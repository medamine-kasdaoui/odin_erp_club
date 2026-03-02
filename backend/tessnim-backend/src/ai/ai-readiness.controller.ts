import {
    Controller, Post, Get, Body, Param,
    UseGuards, Request, Delete,
} from '@nestjs/common';
import { AiReadinessService } from './ai-readiness.service';
import { PlayerMetricsDto, SquadMetricsDto } from './dto/player-metrics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ai/readiness')
@UseGuards(JwtAuthGuard)
export class AiReadinessController {
    constructor(private readonly service: AiReadinessService) { }

    // Analyze a single player
    @Post()
    analyzePlayer(@Body() dto: PlayerMetricsDto, @Request() req) {
        return this.service.analyzePlayer(dto, req.user.clubId);
    }

    // Analyze a full squad (called in a loop from Flutter)
    @Post('squad')
    async analyzeSquad(@Body() body: SquadMetricsDto, @Request() req) {
        const results = [];
        for (const player of body.players) {
            player.matchDate = body.matchDate;
            const result = await this.service.analyzePlayer(player, req.user.clubId);
            results.push(result);
        }
        return { results };
    }

    // Get cached results for a match date
    @Get(':matchDate')
    getCached(@Param('matchDate') matchDate: string, @Request() req) {
        return this.service.getCachedResults(req.user.clubId, matchDate);
    }

    // Clear results for re-analysis
    @Delete(':matchDate')
    clearResults(@Param('matchDate') matchDate: string, @Request() req) {
        return this.service.clearResults(req.user.clubId, matchDate);
    }
}

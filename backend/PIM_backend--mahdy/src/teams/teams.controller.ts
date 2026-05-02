import {
    Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
    constructor(private readonly teamsService: TeamsService) { }

    @Get()
    findAll(@Request() req, @Query('clubId') clubId?: string) {
        const targetClubId = clubId || req.user.clubId;
        return this.teamsService.findAll(targetClubId);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.teamsService.findOne(id, req.user.clubId);
    }

    @Post()
    create(@Body() createTeamDto: CreateTeamDto, @Request() req) {
        if (!createTeamDto.clubId) {
            createTeamDto.clubId = req.user.clubId;
        }
        return this.teamsService.create(createTeamDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.teamsService.remove(id, req.user.clubId);
    }
}

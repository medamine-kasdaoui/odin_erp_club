import {
    Controller, Get, Post, Put, Delete, Patch, Body, Param, Query,
    UseGuards, Request,
} from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignTeamDto } from './dto/assign-team.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlayerStatus } from './entities/player.entity';

@Controller('players')
@UseGuards(JwtAuthGuard)
export class PlayersController {
    constructor(private readonly playersService: PlayersService) { }

    @Get()
    findAll(
        @Request() req,
        @Query('clubId') clubId?: string,
        @Query('status') status?: PlayerStatus,
        @Query('teamId') teamId?: string,
        @Query('position') position?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const targetClubId = clubId || req.user.clubId;
        return this.playersService.findAll(targetClubId, {
            status,
            teamId,
            position,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
        });
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.playersService.findOne(id, req.user.clubId);
    }

    @Post()
    create(@Body() createPlayerDto: CreatePlayerDto, @Request() req) {
        if (!createPlayerDto.clubId) {
            createPlayerDto.clubId = req.user.clubId;
        }
        return this.playersService.create(createPlayerDto, req.user.userId);
    }

    @Put(':id')
    update(
        @Param('id') id: string,
        @Body() updatePlayerDto: UpdatePlayerDto,
        @Request() req,
    ) {
        return this.playersService.update(id, req.user.clubId, updatePlayerDto, req.user.userId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.playersService.remove(id, req.user.clubId);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id') id: string,
        @Body() updateStatusDto: UpdateStatusDto,
        @Request() req,
    ) {
        return this.playersService.updateStatus(id, req.user.clubId, updateStatusDto, req.user.userId);
    }

    @Get(':id/history')
    getHistory(@Param('id') id: string, @Request() req) {
        return this.playersService.getHistory(id, req.user.clubId);
    }

    @Post(':id/assign-team')
    assignTeam(
        @Param('id') id: string,
        @Body() assignTeamDto: AssignTeamDto,
        @Request() req,
    ) {
        return this.playersService.assignTeam(id, req.user.clubId, assignTeamDto, req.user.userId);
    }
}

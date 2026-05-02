import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayersService } from './players.service';

@ApiTags('players')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post()
  create(@Body() createPlayerDto: CreatePlayerDto) {
    return this.playersService.create(createPlayerDto);
  }

  @Post('bulk')
  createMany(@Body() players: CreatePlayerDto[]) {
    return this.playersService.createMany(players);
  }

  @Post('archive')
  archiveMany(@Body() body: { ids: string[] }) {
    return this.playersService.archiveMany(body.ids);
  }

  @Get()
  findAll(
    @Query('includeArchived') includeArchived?: string,
    @Query('status') status?: string,
    @Query('position') position?: string
  ) {
    const include = includeArchived === 'true';
    if (status || position) {
      return this.playersService.findWithFilters({ status, position, includeArchived: include });
    }
    return this.playersService.findAll(include);
  }

  @Get('archived')
  findArchived() {
    return this.playersService.findArchived();
  }

  @Get('labeled')
  findLabeled() {
    return this.playersService.findLabeled();
  }

  @Get('count')
  async count() {
    const total = await this.playersService.count();
    return { total };
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.playersService.getHistory(id);
  }

  @Get(':id/analyses')
  analyses(@Param('id') id: string) {
    return this.playersService.getAnalyses(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.playersService.findById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updatePlayerDto: UpdatePlayerDto) {
    return this.playersService.update(id, updatePlayerDto);
  }

  @Post(':id/clear-medical')
  clearMedical(@Param('id') id: string) {
    return this.playersService.clearMedical(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('description') description?: string
  ) {
    return this.playersService.updateStatus(id, status, description);
  }

  @Post(':id/assign-team')
  assignTeam(@Param('id') id: string, @Body('teamId') teamId: string) {
    return this.playersService.assignTeam(id, teamId);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() updatePlayerDto: UpdatePlayerDto) {
    return this.playersService.update(id, updatePlayerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.playersService.remove(id);
  }
}

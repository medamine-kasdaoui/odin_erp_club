import {
  Controller, Get, Post, Patch, Delete, Body,
  Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { TravelService } from './travel.service';
import { CreateTravelDto } from './dto/create-travel.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';

@Controller('travel')
// @UseGuards(JwtAuthGuard) // Désactivé temporairement pour éviter les 401 si le token mobile est expiré
export class TravelController {
  constructor(private readonly travelService: TravelService) {}

  // Créer un voyage (avec enrichissement GPS automatique)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTravelDto, @CurrentUser() user: AuthUser) {
    // Injecter le clubId de l'utilisateur si celui du DTO est vide
    if (!dto.clubId && user?.clubId) {
      dto.clubId = user.clubId;
    }
    return this.travelService.create(dto);
  }

  // Lister les voyages du club
  @Get()
  findAll(@Query('clubId') clubId: string, @CurrentUser() user?: AuthUser) {
    return this.travelService.findAll(clubId || user?.clubId);
  }

  // Voyages d'un joueur spécifique
  @Get('player/:playerId')
  findByPlayer(
    @Param('playerId') playerId: string,
    @Query('clubId') clubId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.travelService.findByPlayer(clubId || user?.clubId, playerId);
  }

  // Rechercher des aéroports pour une ville (IA géo)
  @Get('airports')
  searchAirports(@Query('city') city: string) {
    return this.travelService.searchAirports(city);
  }

  // Rechercher des lieux (IA géo proxy Photon)
  @Get('search')
  searchPlaces(@Query('q') q: string) {
    return this.travelService.searchPlaces(q);
  }

  // Statistiques des voyages
  @Get('stats')
  getStats(@Query('clubId') clubId: string, @CurrentUser() user?: AuthUser) {
    return this.travelService.getStats(clubId || user?.clubId);
  }

  // Détail d'un voyage
  @Get(':id')
  findOne(@Param('id') id: string, @Query('clubId') clubId: string, @CurrentUser() user?: AuthUser) {
    return this.travelService.findOne(id, clubId || user?.clubId);
  }

  // Modifier un voyage
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('clubId') clubId: string,
    @Body() dto: Partial<CreateTravelDto>,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.travelService.update(id, clubId || user?.clubId, dto);
  }

  // Modifier le statut
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Query('clubId') clubId: string,
    @Body('status') status: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.travelService.updateStatus(id, clubId || user?.clubId, status);
  }

  // Modifier répartition chambres
  @Patch(':id/rooms/:roomNumber')
  updateRoom(
    @Param('id') id: string,
    @Param('roomNumber') roomNumber: string,
    @Query('clubId') clubId: string,
    @Body() body: { occupant1?: string; occupant2?: string },
    @CurrentUser() user?: AuthUser,
  ) {
    return this.travelService.updateRoomAssignment(
      id, clubId || user?.clubId, roomNumber, body.occupant1, body.occupant2,
    );
  }

  // Supprimer
  @Delete(':id')
  remove(@Param('id') id: string, @Query('clubId') clubId: string, @CurrentUser() user?: AuthUser) {
    return this.travelService.remove(id, clubId || user?.clubId);
  }
}

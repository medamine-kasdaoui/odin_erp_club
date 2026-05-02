import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Travel, TravelDocument } from './schemas/travel.schema';
import { CreateTravelDto } from './dto/create-travel.dto';
import { GeoAiService } from './services/geo-ai.service';
import { GamificationService } from '../gamification/gamification.service';
import { Club, ClubDocument } from '../clubs/schemas/club.schema';

@Injectable()
export class TravelService {
  constructor(
    @InjectModel(Travel.name) private travelModel: Model<TravelDocument>,
    @InjectModel(Club.name) private clubModel: Model<ClubDocument>,
    private readonly geoAiService: GeoAiService,
    private readonly gamificationService: GamificationService,
  ) { }

  // Helper pour assurer un clubId valide en cas de transmission vide depuis le client
  private async getValidClubId(clubId?: string): Promise<string> {
    if (clubId && clubId.trim().length > 0 && clubId !== 'null' && clubId !== 'undefined') {
      return clubId;
    }
    const firstClub = await this.clubModel.findOne().select('_id').lean<{ _id: Types.ObjectId }>();
    if (!firstClub) throw new BadRequestException('ID Club manquant et aucun club trouvé en base.');
    return String(firstClub._id);
  }

  // ─── Créer un voyage + enrichissement GPS automatique ────────────────────
  async create(dto: CreateTravelDto): Promise<TravelDocument> {
    dto.clubId = await this.getValidClubId(dto.clubId);

    // Validation des dates
    const departureDate = new Date(dto.departure.at);
    const returnDate = new Date(dto.return.at);
    if (departureDate >= returnDate) {
      throw new BadRequestException('La date de départ doit être avant la date de retour');
    }

    // Enrichissement GPS automatique (non-bloquant si l'API échoue)
    let geoData: any = {};
    try {
      geoData = await this.geoAiService.enrichTravelWithGeoData(
        dto.destination,
        dto.departure.from,
        dto.hotel.address,
      );
    } catch (e) {
      // L'enrichissement GPS est optionnel — ne pas bloquer la création
    }

    const travel = new this.travelModel({
      ...dto,
      clubId: dto.clubId,
      matchId: dto.matchId ? new Types.ObjectId(dto.matchId) : null,
      participants: {
        players: dto.participants.players.map(id => new Types.ObjectId(id)),
        staff: dto.participants.staff.map(id => new Types.ObjectId(id)),
      },
      // GPS enrichi par l'IA
      destinationLat: geoData.destinationLat,
      destinationLng: geoData.destinationLng,
      departureAirport: geoData.departureAirport,
      arrivalAirport: geoData.arrivalAirport,
      hotel: {
        ...dto.hotel,
        lat: geoData.hotelLat,
        lng: geoData.hotelLng,
        rooms: dto.hotel.rooms.map(room => ({
          ...room,
          occupant1: room.occupant1 ? new Types.ObjectId(room.occupant1) : null,
          occupant2: room.occupant2 ? new Types.ObjectId(room.occupant2) : null,
        }))
      },
    });

    return travel.save();
  }

  // ─── Lister les voyages d'un club ────────────────────────────────────────
  async findAll(clubId: string) {
    const cid = await this.getValidClubId(clubId);
    return this.travelModel
      .find({ clubId: cid })
      .populate('matchId', 'homeTeam awayTeam date')
      .populate({
        path: 'participants.players',
        select: 'name firstName lastName position photo jerseyNumber',
        model: 'Player'
      })
      .populate('participants.staff', 'name role')
      .populate('hotel.rooms.occupant1', 'name firstName lastName fullName')
      .populate('hotel.rooms.occupant2', 'name firstName lastName fullName')
      .sort({ 'departure.at': -1 })
      .exec();
  }

  // ─── Voyages d'un joueur spécifique ──────────────────────────────────────
  async findByPlayer(clubId: string, playerId: string) {
    const cid = await this.getValidClubId(clubId);
    return this.travelModel
      .find({
        clubId: cid,
        'participants.players': new Types.ObjectId(playerId),
      })
      .sort({ 'departure.at': -1 })
      .exec();
  }

  // ─── Détail d'un voyage ───────────────────────────────────────────────────
  async findOne(id: string, clubId: string) {
    const cid = await this.getValidClubId(clubId);
    const travel = await this.travelModel
      .findOne({ _id: id, clubId: cid })
      .populate('matchId', 'homeTeam awayTeam date')
      .populate({
        path: 'participants.players',
        select: 'name firstName lastName position photo jerseyNumber',
        model: 'Player'
      })
      .populate('participants.staff', 'name role')
      .populate('hotel.rooms.occupant1', 'name firstName lastName fullName')
      .populate('hotel.rooms.occupant2', 'name firstName lastName fullName')
      .exec();
    if (!travel) throw new NotFoundException('Voyage non trouvé');
    return travel;
  }

  // ─── Mettre à jour (PATCH partiel avec validation) ───────────────────────
  async update(id: string, clubId: string, updateDto: Partial<CreateTravelDto>) {
    const cid = await this.getValidClubId(clubId);
    const travel = await this.travelModel.findOne({ _id: id, clubId: cid });
    if (!travel) throw new NotFoundException('Voyage non trouvé');

    const updateData: any = { ...updateDto };

    // 1. Validation des dates si fournies
    if (updateDto.departure?.at || updateDto.return?.at) {
      const dep = new Date(updateDto.departure?.at || travel.departure.at);
      const ret = new Date(updateDto.return?.at || travel.return.at);
      if (dep >= ret) {
        throw new BadRequestException('La date de départ doit être avant le retour');
      }
    }

    // 2. Conversion des ObjectIds pour le Match
    if (updateDto.matchId) {
      updateData.matchId = new Types.ObjectId(updateDto.matchId);
    }

    // 3. Conversion des ObjectIds pour les Participants
    if (updateDto.participants) {
      updateData.participants = {
        players: updateDto.participants.players?.map(pid => new Types.ObjectId(pid)) || travel.participants.players,
        staff: updateDto.participants.staff?.map(sid => new Types.ObjectId(sid)) || travel.participants.staff,
      };
    }

    // 4. Conversion des ObjectIds pour les Chambres
    if (updateDto.hotel?.rooms) {
      updateData['hotel.rooms'] = updateDto.hotel.rooms.map(room => ({
        ...room,
        occupant1: room.occupant1 ? new Types.ObjectId(room.occupant1) : null,
        occupant2: room.occupant2 ? new Types.ObjectId(room.occupant2) : null,
      }));
      // On retire 'hotel' de updateData pour éviter d'écraser tout l'objet hotel par erreur
      delete updateData.hotel;
    } else if (updateDto.hotel) {
      // Si on modifie d'autres champs de l'hôtel sans toucher aux chambres
      updateData.hotel = { ...travel.toObject().hotel, ...updateDto.hotel };
    }

    const updated = await this.travelModel
      .findOneAndUpdate({ _id: id, clubId: cid }, { $set: updateData }, { new: true })
      .exec();

    return updated;
  }

  // ─── Mettre à jour le statut uniquement ──────────────────────────────────
  async updateStatus(id: string, clubId: string, status: string) {
    const cid = await this.getValidClubId(clubId);
    const travel = await this.travelModel.findOneAndUpdate(
      { _id: id, clubId: cid },
      { $set: { status } },
      { new: true },
    );
    if (!travel) throw new NotFoundException('Voyage non trouvé');

    // --- Gamification Trigger ---
    if (status === 'completed' && travel.participants?.players) {
      for (const playerId of travel.participants.players) {
        await this.gamificationService.addAction({
          userId: playerId.toString(),
          actionType: 'Déplacement complété',
          points: 15,
          moduleId: 'travel',
          description: `Participation au voyage vers ${travel.destination}`
        });
      }
    }

    return travel;
  }

  // ─── Statistiques des voyages ─────────────────────────────────────────────
  async getStats(clubId: string) {
    const cid = await this.getValidClubId(clubId);
    const statuses = await this.travelModel.aggregate([
      { $match: { clubId: cid } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);
    
    const modes = await this.travelModel.aggregate([
      { $match: { clubId: cid } },
      {
        $group: {
          _id: "$departure.mode",
          count: { $sum: 1 }
        }
      }
    ]);

    return [...statuses, ...modes];
  }

  // ─── Modifier la répartition des chambres ────────────────────────────────
  async updateRoomAssignment(
    travelId: string,
    clubId: string,
    roomNumber: string,
    occupant1?: string,
    occupant2?: string,
  ) {
    const cid = await this.getValidClubId(clubId);
    return this.travelModel.findOneAndUpdate(
      { _id: travelId, clubId: cid, 'hotel.rooms.roomNumber': roomNumber },
      {
        $set: {
          'hotel.rooms.$.occupant1': occupant1 ? new Types.ObjectId(occupant1) : null,
          'hotel.rooms.$.occupant2': occupant2 ? new Types.ObjectId(occupant2) : null,
        },
      },
      { new: true },
    );
  }

  // ─── Rechercher aéroports pour une ville ─────────────────────────────────
  async searchAirports(city: string) {
    return this.geoAiService.findAirportsNearCity(city);
  }

  // ─── Rechercher des lieux (Géo-IA Proxy) ──────────────────────────────────
  async searchPlaces(query: string) {
    return this.geoAiService.searchPlaces(query);
  }

  // ─── Supprimer ────────────────────────────────────────────────────────────
  async remove(id: string, clubId: string) {
    const cid = await this.getValidClubId(clubId);
    const result = await this.travelModel.findOneAndDelete({ _id: id, clubId: cid });
    if (!result) throw new NotFoundException('Voyage non trouvé');
    return { message: 'Voyage supprimé avec succès' };
  }
}

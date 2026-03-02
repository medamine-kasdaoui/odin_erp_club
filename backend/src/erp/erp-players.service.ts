import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ErpPlayer,
  ErpPlayerDocument,
  PLAYER_STATUS,
} from './schemas/erp-player.schema';
import {
  ErpPlayerHistory,
  ErpPlayerHistoryDocument,
} from './schemas/erp-player-history.schema';

export interface ErpPlayersFilter {
  status?: string;
  teamId?: string;
  position?: string;
  isProspect?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ErpPlayersService {
  constructor(
    @InjectModel(ErpPlayer.name)
    private readonly playerModel: Model<ErpPlayerDocument>,
    @InjectModel(ErpPlayerHistory.name)
    private readonly historyModel: Model<ErpPlayerHistoryDocument>
  ) {}

  private toObjectId(value?: string) {
    if (!value) return undefined;
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }

  async findAll(clubId: Types.ObjectId, filters: ErpPlayersFilter = {}) {
    const { status, teamId, position, isProspect, page = 1, limit = 20 } = filters;

    const query: Record<string, unknown> = { clubId };
    if (status) query.status = status;
    if (position) query.position = position;
    if (teamId) query.teamId = this.toObjectId(teamId);
    if (isProspect !== undefined) {
      query.isProspect = isProspect === 'true' || isProspect === '1';
    }

    const total = await this.playerModel.countDocuments(query);
    const players = await this.playerModel
      .find(query)
      .sort({ lastName: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('team')
      .populate('category')
      .exec();

    return {
      success: true,
      data: {
        players,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    };
  }

  async findOne(id: string, clubId: Types.ObjectId) {
    const player = await this.playerModel
      .findOne({ _id: id, clubId })
      .populate('team')
      .populate('category')
      .exec();

    if (!player) {
      throw new NotFoundException(
        `Joueur #${id} introuvable ou vous n'avez pas les droits`
      );
    }
    return player;
  }

  async create(clubId: Types.ObjectId, payload: Record<string, unknown>, createdBy?: Types.ObjectId) {
    const player = new this.playerModel({
      ...payload,
      clubId,
      createdBy
    });

    const saved = await player.save();

    await this.addHistory(saved._id, 'profile_update', {
      description: 'Joueur créé',
      newValue: { firstName: saved.firstName, lastName: saved.lastName },
      createdBy
    });

    return this.findOne(String(saved._id), clubId);
  }

  async update(id: string, clubId: Types.ObjectId, payload: Record<string, unknown>, updatedBy?: Types.ObjectId) {
    const player = await this.findOne(id, clubId);

    const previousValue = {
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position
    };

    Object.assign(player, payload);
    const updated = await player.save();

    await this.addHistory(updated._id, 'profile_update', {
      description: 'Profil mis à jour',
      previousValue,
      newValue: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        position: updated.position
      },
      createdBy: updatedBy
    });

    return this.findOne(String(updated._id), clubId);
  }

  async remove(id: string, clubId: Types.ObjectId) {
    const player = await this.findOne(id, clubId);
    await player.deleteOne();
    return { success: true, message: 'Joueur supprimé avec succès' };
  }

  async updateStatus(
    id: string,
    clubId: Types.ObjectId,
    status: string,
    description?: string,
    returnDate?: string,
    updatedBy?: Types.ObjectId
  ) {
    if (!PLAYER_STATUS.includes(status as any)) {
      throw new BadRequestException('Invalid status');
    }

    const player = await this.findOne(id, clubId);
    const previousStatus = player.status;

    player.status = status;
    if (returnDate) {
      player.returnDate = new Date(returnDate);
    }

    const updated = await player.save();

    let eventType = 'status_change';
    if (status === 'injured') eventType = 'injury';
    if (status === 'suspended') eventType = 'suspension';

    await this.addHistory(updated._id, eventType, {
      description: description ?? `Statut changé: ${previousStatus} → ${status}`,
      previousValue: { status: previousStatus },
      newValue: { status, returnDate },
      createdBy: updatedBy
    });

    return this.findOne(String(updated._id), clubId);
  }

  async getHistory(playerId: string, clubId: Types.ObjectId) {
    await this.findOne(playerId, clubId);
    return this.historyModel
      .find({ playerId: this.toObjectId(playerId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async assignTeam(
    id: string,
    clubId: Types.ObjectId,
    teamId: string,
    updatedBy?: Types.ObjectId
  ) {
    const player = await this.findOne(id, clubId);
    const previousTeamId = player.teamId;

    player.teamId = this.toObjectId(teamId);
    await player.save();

    await this.addHistory(player._id, 'team_change', {
      description: 'Affecté à une nouvelle équipe',
      previousValue: { teamId: previousTeamId?.toString() },
      newValue: { teamId },
      createdBy: updatedBy
    });

    return this.findOne(String(player._id), clubId);
  }

  private async addHistory(
    playerId: Types.ObjectId,
    eventType: string,
    options: {
      description?: string;
      previousValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      createdBy?: Types.ObjectId;
    }
  ) {
    const history = new this.historyModel({
      playerId,
      eventType,
      eventDate: new Date(),
      description: options.description,
      previousValue: options.previousValue,
      newValue: options.newValue,
      createdBy: options.createdBy
    });
    return history.save();
  }
}

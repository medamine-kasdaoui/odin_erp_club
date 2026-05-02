import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Player, PlayerDocument } from './schemas/player.schema';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Injectable()
export class PlayersService {
  constructor(@InjectModel(Player.name) private playerModel: Model<PlayerDocument>) {}

  async create(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const player = new this.playerModel(createPlayerDto);
    return player.save();
  }

  async createMany(players: CreatePlayerDto[]): Promise<Player[]> {
    const created: Player[] = [];
    for (const dto of players) {
      const player = new this.playerModel(dto);
      created.push(await player.save());
    }
    return created;
  }

  async findAll(includeArchived = false): Promise<Player[]> {
    if (includeArchived) {
      return this.playerModel.find().exec();
    }
    return this.playerModel
      .find({
        $or: [{ status: { $regex: /^active$/i } }, { status: { $exists: false } }],
      })
      .exec();
  }

  async findWithFilters(filters: {
    status?: string;
    position?: string;
    includeArchived?: boolean;
  }): Promise<Player[]> {
    const query: Record<string, any> = {};
    if (filters.status) {
      query.status = { $regex: new RegExp(`^${filters.status}$`, 'i') };
    } else if (!filters.includeArchived) {
      query.$or = [{ status: { $regex: /^active$/i } }, { status: { $exists: false } }];
    }
    if (filters.position) {
      query.position = filters.position;
    }
    return this.playerModel.find(query).exec();
  }

  async findArchived(): Promise<Player[]> {
    return this.playerModel
      .find({ status: { $regex: /^archived$/i } })
      .exec();
  }

  async findById(id: string): Promise<Player> {
    const player = await this.playerModel.findById(id).exec();
    if (!player) {
      throw new NotFoundException(`Player with ID "${id}" not found`);
    }
    return player;
  }

  async findByUserId(userId: string): Promise<Player> {
    const player = await this.playerModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!player) {
      throw new NotFoundException(`Player with userId "${userId}" not found`);
    }
    return player;
  }

  /**
   * Accepts either a Player _id or a linked User _id.
   * Useful for mobile sessions where player users only have `sub` (userId).
   */
  async resolveByAnyId(idOrUserId: string): Promise<Player> {
    try {
      return await this.findById(idOrUserId);
    } catch (_) {
      return this.findByUserId(idOrUserId);
    }
  }

  async update(id: string, updatePlayerDto: UpdatePlayerDto): Promise<Player> {
    const player = await this.playerModel
      .findByIdAndUpdate(id, updatePlayerDto, { new: true })
      .exec();
    if (!player) {
      throw new NotFoundException(`Player with ID "${id}" not found`);
    }
    return player;
  }

  async remove(id: string): Promise<void> {
    const result = await this.playerModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Player with ID "${id}" not found`);
    }
  }

  async clearMedical(id: string): Promise<Player> {
    const player = await this.playerModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            isInjured: false,
            lastInjuryType: null,
            lastRecoveryDays: 0,
            lastSeverity: null,
            lastInjuryProbability: 0,
            lastMatchFatigue: 0,
            lastMatchLoad: 0,
            lastMatchInjuryProbability: 0,
          },
        },
        { new: true },
      )
      .exec();
    if (!player) {
      throw new NotFoundException(`Player with ID "${id}" not found`);
    }
    return player;
  }

  async updateStatus(id: string, status: string, description?: string): Promise<Player> {
    const player = await this.playerModel
      .findByIdAndUpdate(
        id,
        {
          $set: { status },
          $push: {
            statusHistory: {
              status,
              description,
              changedAt: new Date()
            }
          }
        },
        { new: true }
      )
      .exec();
    if (!player) {
      throw new NotFoundException(`Player with ID "${id}" not found`);
    }
    return player;
  }

  async getHistory(id: string) {
    const player = await this.findById(id);
    return (player.statusHistory ?? []).map((entry: any, index: number) => ({
      id: `${id}-${index}`,
      playerId: id,
      type: 'status',
      title: entry.status,
      description: entry.description ?? null,
      date: entry.changedAt
    }));
  }

  async assignTeam(id: string, teamId: string): Promise<Player> {
    const player = await this.playerModel
      .findByIdAndUpdate(
        id,
        { $set: { teamId: Types.ObjectId.isValid(teamId) ? new Types.ObjectId(teamId) : teamId } },
        { new: true }
      )
      .exec();
    if (!player) {
      throw new NotFoundException(`Player with ID "${id}" not found`);
    }
    return player;
  }

  async getAnalyses(id: string) {
    await this.findById(id);
    return [];
  }

  async count(): Promise<number> {
    return this.playerModel
      .countDocuments({
        $or: [{ status: { $regex: /^active$/i } }, { status: { $exists: false } }],
      })
      .exec();
  }

  async findLabeled(): Promise<Player[]> {
    return this.playerModel.find({ label: { $ne: null } }).exec();
  }

  async archiveMany(ids: string[]): Promise<{ archivedCount: number }> {
    const result = await this.playerModel
      .updateMany({ _id: { $in: ids } }, { $set: { status: 'archived' } })
      .exec();
    return { archivedCount: result.modifiedCount };
  }
}

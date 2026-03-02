import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player, PlayerStatus } from './entities/player.entity';
import { PlayerHistory, HistoryEventType } from './entities/player-history.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignTeamDto } from './dto/assign-team.dto';

export interface PlayersFilter {
    status?: PlayerStatus;
    teamId?: string;
    position?: string;
    page?: number;
    limit?: number;
}

@Injectable()
export class PlayersService {
    constructor(
        @InjectRepository(Player)
        private readonly playerRepository: Repository<Player>,
        @InjectRepository(PlayerHistory)
        private readonly historyRepository: Repository<PlayerHistory>,
    ) { }

    async findAll(clubId: string, filters: PlayersFilter = {}) {
        const { status, teamId, position, page = 1, limit = 20 } = filters;

        const query = this.playerRepository.createQueryBuilder('player')
            .leftJoinAndSelect('player.team', 'team')
            .leftJoinAndSelect('player.category', 'category')
            .where('player.clubId = :clubId', { clubId });

        if (status) {
            query.andWhere('player.status = :status', { status });
        }
        if (teamId) {
            query.andWhere('player.teamId = :teamId', { teamId });
        }
        if (position) {
            query.andWhere('player.position = :position', { position });
        }

        const total = await query.getCount();
        const players = await query
            .orderBy('player.lastName', 'ASC')
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();

        return {
            success: true,
            data: {
                players,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            },
        };
    }

    async findOne(id: string, clubId: string): Promise<Player> {
        const player = await this.playerRepository.findOne({
            where: { id, clubId },
            relations: ['team', 'category'],
        });
        if (!player) {
            throw new NotFoundException(`Joueur #${id} introuvable ou vous n'avez pas les droits`);
        }
        return player;
    }

    async create(createPlayerDto: CreatePlayerDto, createdBy: string): Promise<Player> {
        const player = this.playerRepository.create({
            ...createPlayerDto,
            createdBy,
        });
        const saved = await this.playerRepository.save(player);

        // Record creation in history
        await this.addHistory(saved.id, HistoryEventType.PROFILE_UPDATE, {
            description: 'Joueur créé',
            newValue: { firstName: saved.firstName, lastName: saved.lastName },
            createdBy,
        });

        return saved;
    }

    async update(id: string, clubId: string, updatePlayerDto: UpdatePlayerDto, updatedBy: string): Promise<Player> {
        const player = await this.findOne(id, clubId);
        const previousValue = {
            firstName: player.firstName,
            lastName: player.lastName,
            position: player.position,
        };

        Object.assign(player, updatePlayerDto);
        const updated = await this.playerRepository.save(player);

        await this.addHistory(id, HistoryEventType.PROFILE_UPDATE, {
            description: 'Profil mis à jour',
            previousValue,
            newValue: { firstName: updated.firstName, lastName: updated.lastName, position: updated.position },
            createdBy: updatedBy,
        });

        return updated;
    }

    async remove(id: string, clubId: string): Promise<{ success: boolean; message: string }> {
        const player = await this.findOne(id, clubId);
        await this.playerRepository.remove(player);
        return { success: true, message: 'Joueur supprimé avec succès' };
    }

    async updateStatus(id: string, clubId: string, updateStatusDto: UpdateStatusDto, updatedBy: string): Promise<Player> {
        const player = await this.findOne(id, clubId);
        const previousStatus = player.status;

        player.status = updateStatusDto.status;
        if (updateStatusDto.returnDate) {
            player.returnDate = new Date(updateStatusDto.returnDate);
        }
        const updated = await this.playerRepository.save(player);

        // Determine event type from new status
        let eventType = HistoryEventType.STATUS_CHANGE;
        if (updateStatusDto.status === PlayerStatus.INJURED) {
            eventType = HistoryEventType.INJURY;
        } else if (updateStatusDto.status === PlayerStatus.SUSPENDED) {
            eventType = HistoryEventType.SUSPENSION;
        }

        await this.addHistory(id, eventType, {
            description: updateStatusDto.description || `Statut changé: ${previousStatus} → ${updateStatusDto.status}`,
            previousValue: { status: previousStatus },
            newValue: {
                status: updateStatusDto.status,
                returnDate: updateStatusDto.returnDate,
            },
            createdBy: updatedBy,
        });

        return updated;
    }

    async getHistory(playerId: string, clubId: string): Promise<PlayerHistory[]> {
        await this.findOne(playerId, clubId); // Ensure player exists and belongs to club
        return this.historyRepository.find({
            where: { playerId },
            order: { createdAt: 'DESC' },
        });
    }

    async assignTeam(id: string, clubId: string, assignTeamDto: AssignTeamDto, updatedBy: string): Promise<Player> {
        const player = await this.findOne(id, clubId);
        const previousTeamId = player.teamId;

        player.teamId = assignTeamDto.teamId;
        const updated = await this.playerRepository.save(player);

        await this.addHistory(id, HistoryEventType.TEAM_CHANGE, {
            description: `Affecté à une nouvelle équipe`,
            previousValue: { teamId: previousTeamId },
            newValue: { teamId: assignTeamDto.teamId },
            createdBy: updatedBy,
        });

        return this.findOne(id, clubId); // Return with relations
    }

    private async addHistory(
        playerId: string,
        eventType: HistoryEventType,
        options: {
            description?: string;
            previousValue?: Record<string, any>;
            newValue?: Record<string, any>;
            createdBy?: string;
        },
    ): Promise<PlayerHistory> {
        const history = this.historyRepository.create({
            playerId,
            eventType,
            eventDate: new Date(),
            description: options.description,
            previousValue: options.previousValue,
            newValue: options.newValue,
            createdBy: options.createdBy,
        });
        return this.historyRepository.save(history);
    }
}

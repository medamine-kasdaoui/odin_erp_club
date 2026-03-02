import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { CreateTeamDto } from './dto/create-team.dto';

@Injectable()
export class TeamsService {
    constructor(
        @InjectRepository(Team)
        private readonly teamRepository: Repository<Team>,
    ) { }

    async findAll(clubId: string): Promise<Team[]> {
        return this.teamRepository.find({
            where: { clubId },
            relations: ['category'],
            order: { name: 'ASC' },
        });
    }

    async findOne(id: string, clubId: string): Promise<Team> {
        const team = await this.teamRepository.findOne({
            where: { id, clubId },
            relations: ['category'],
        });
        if (!team) {
            throw new NotFoundException(`Équipe #${id} introuvable ou accès refusé`);
        }
        return team;
    }

    async create(createTeamDto: CreateTeamDto): Promise<Team> {
        const team = this.teamRepository.create(createTeamDto);
        return this.teamRepository.save(team);
    }

    async remove(id: string, clubId: string): Promise<{ success: boolean; message: string }> {
        const team = await this.findOne(id, clubId);
        await this.teamRepository.remove(team);
        return { success: true, message: 'Équipe supprimée avec succès' };
    }
}

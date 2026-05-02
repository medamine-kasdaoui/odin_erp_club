import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Team, TeamDocument } from './schemas/team.schema';
import { CreateTeamDto } from './dto/create-team.dto';

@Injectable()
export class TeamsService {
    constructor(
        @InjectModel(Team.name)
        private readonly teamModel: Model<TeamDocument>,
    ) { }

    async findAll(clubId: string): Promise<Team[]> {
        return this.teamModel.find({ clubId })
            .populate('category')
            .sort({ name: 1 })
            .exec();
    }

    async findOne(id: string, clubId: string): Promise<Team> {
        const team = await this.teamModel.findOne({ _id: id, clubId })
            .populate('category')
            .exec();
        if (!team) {
            throw new NotFoundException(`Équipe #${id} introuvable ou accès refusé`);
        }
        return team;
    }

    async create(createTeamDto: CreateTeamDto): Promise<Team> {
        const team = new this.teamModel(createTeamDto);
        return team.save();
    }

    async remove(id: string, clubId: string): Promise<{ success: boolean; message: string }> {
        const team = await this.teamModel.findOneAndDelete({ _id: id, clubId }).exec();
        if (!team) {
            throw new NotFoundException(`Équipe #${id} introuvable ou accès refusé`);
        }
        return { success: true, message: 'Équipe supprimée avec succès' };
    }
}

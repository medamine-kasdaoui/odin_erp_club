import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ErpTeam, ErpTeamDocument } from './schemas/erp-team.schema';

@Injectable()
export class ErpTeamsService {
  constructor(
    @InjectModel(ErpTeam.name)
    private readonly teamModel: Model<ErpTeamDocument>
  ) {}

  private toObjectId(value?: string) {
    if (!value) return undefined;
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }

  async findAll(clubId: Types.ObjectId, categoryId?: string) {
    const query: Record<string, unknown> = { clubId };
    if (categoryId) query.categoryId = this.toObjectId(categoryId);

    return this.teamModel.find(query).sort({ name: 1 }).populate('category').exec();
  }

  async findOne(id: string, clubId: Types.ObjectId) {
    const team = await this.teamModel
      .findOne({ _id: id, clubId })
      .populate('category')
      .exec();
    if (!team) throw new NotFoundException('Équipe introuvable');
    return team;
  }

  async create(clubId: Types.ObjectId, payload: Record<string, unknown>) {
    const team = new this.teamModel({
      ...payload,
      clubId,
      categoryId: payload['categoryId']
        ? this.toObjectId(String(payload['categoryId']))
        : undefined
    });
    return team.save();
  }

  async remove(id: string, clubId: Types.ObjectId) {
    const team = await this.findOne(id, clubId);
    await team.deleteOne();
    return { success: true, message: 'Équipe supprimée avec succès' };
  }
}

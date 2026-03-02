import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ErpStaffMember, ErpStaffDocument } from './schemas/erp-staff.schema';

export interface ErpStaffFilter {
  role?: string;
  teamId?: string;
  status?: string;
}

@Injectable()
export class ErpStaffService {
  constructor(
    @InjectModel(ErpStaffMember.name)
    private readonly staffModel: Model<ErpStaffDocument>
  ) {}

  private toObjectId(value?: string) {
    if (!value) return undefined;
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }

  async findAll(clubId: Types.ObjectId, filters: ErpStaffFilter = {}) {
    const { role, teamId, status } = filters;

    const query: Record<string, unknown> = { clubId };
    if (role) query.role = role;
    if (teamId) query.teamId = this.toObjectId(teamId);
    if (status) query.status = status;

    const staff = await this.staffModel
      .find(query)
      .sort({ lastName: 1 })
      .populate('team')
      .exec();

    return { success: true, data: { staff, total: staff.length } };
  }

  async findOne(id: string, clubId: Types.ObjectId) {
    const member = await this.staffModel
      .findOne({ _id: id, clubId })
      .populate('team')
      .exec();
    if (!member) {
      throw new NotFoundException(
        `Membre du staff #${id} introuvable ou vous n'avez pas les droits`
      );
    }
    return member;
  }

  async create(clubId: Types.ObjectId, payload: Record<string, unknown>, createdBy?: Types.ObjectId) {
    const member = new this.staffModel({
      ...payload,
      clubId,
      createdBy,
      teamId: payload['teamId'] ? this.toObjectId(String(payload['teamId'])) : undefined
    });
    return member.save();
  }

  async update(id: string, clubId: Types.ObjectId, payload: Record<string, unknown>) {
    const member = await this.findOne(id, clubId);
    if (payload['teamId']) {
      payload = { ...payload, teamId: this.toObjectId(String(payload['teamId'])) };
    }
    Object.assign(member, payload);
    return member.save();
  }

  async remove(id: string, clubId: Types.ObjectId) {
    const member = await this.findOne(id, clubId);
    await member.deleteOne();
    return { success: true, message: 'Membre du staff supprimé avec succès' };
  }
}

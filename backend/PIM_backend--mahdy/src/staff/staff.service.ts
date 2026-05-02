import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { StaffMember, StaffMemberDocument } from './schemas/staff-member.schema';

interface StaffFilters {
  role?: string;
  teamId?: string;
  status?: string;
}

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(StaffMember.name)
    private readonly staffModel: Model<StaffMemberDocument>
  ) {}

  async findAll(filters: StaffFilters = {}) {
    const query: FilterQuery<StaffMemberDocument> = {};
    if (filters.role) {
      query.role = filters.role;
    }
    if (filters.teamId && Types.ObjectId.isValid(filters.teamId)) {
      query.teamId = new Types.ObjectId(filters.teamId);
    }
    if (filters.status) {
      query.status = filters.status;
    }

    const staff = await this.staffModel.find(query).sort({ lastName: 1, firstName: 1 }).lean();
    return staff.map((member) => this.normalize(member));
  }

  async findOne(id: string) {
    const member = await this.staffModel.findById(id).lean();
    if (!member) {
      throw new NotFoundException('Staff member not found');
    }
    return this.normalize(member);
  }

  async create(payload: Record<string, unknown>) {
    const member = await this.staffModel.create(this.preparePayload(payload));
    return this.normalize(member.toObject());
  }

  async update(id: string, payload: Record<string, unknown>) {
    const member = await this.staffModel
      .findByIdAndUpdate(id, this.preparePayload(payload), { new: true })
      .lean();
    if (!member) {
      throw new NotFoundException('Staff member not found');
    }
    return this.normalize(member);
  }

  async remove(id: string) {
    const result = await this.staffModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Staff member not found');
    }
    return { success: true };
  }

  private preparePayload(payload: Record<string, unknown>) {
    const data = { ...payload } as Record<string, unknown>;
    for (const key of ['clubId', 'teamId']) {
      const value = data[key];
      if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
        data[key] = new Types.ObjectId(value);
      } else if (!value) {
        delete data[key];
      }
    }
    if (!data.status) {
      data.status = 'active';
    }
    return data;
  }

  private normalize(member: Record<string, any>) {
    return {
      ...member,
      id: member._id?.toString?.() ?? member.id,
      clubId: member.clubId?.toString?.() ?? member.clubId ?? '',
      teamId: member.teamId?.toString?.() ?? member.teamId ?? null
    };
  }
}

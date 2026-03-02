import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffMember } from './entities/staff-member.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

export interface StaffFilter {
    role?: string;
    teamId?: string;
    status?: string;
}

@Injectable()
export class StaffService {
    constructor(
        @InjectRepository(StaffMember)
        private readonly staffRepository: Repository<StaffMember>,
    ) { }

    async findAll(clubId: string, filters: StaffFilter = {}) {
        const { role, teamId, status } = filters;

        const query = this.staffRepository.createQueryBuilder('staff')
            .leftJoinAndSelect('staff.team', 'team')
            .where('staff.clubId = :clubId', { clubId });

        if (role) {
            query.andWhere('staff.role = :role', { role });
        }
        if (teamId) {
            query.andWhere('staff.teamId = :teamId', { teamId });
        }
        if (status) {
            query.andWhere('staff.status = :status', { status });
        }

        const staff = await query.orderBy('staff.lastName', 'ASC').getMany();
        return { success: true, data: { staff, total: staff.length } };
    }

    async findOne(id: string, clubId: string): Promise<StaffMember> {
        const member = await this.staffRepository.findOne({
            where: { id, clubId },
            relations: ['team'],
        });
        if (!member) {
            throw new NotFoundException(`Membre du staff #${id} introuvable ou vous n'avez pas les droits`);
        }
        return member;
    }

    async create(createStaffDto: CreateStaffDto, createdBy: string): Promise<StaffMember> {
        const member = this.staffRepository.create({
            ...createStaffDto,
            createdBy,
        });
        return this.staffRepository.save(member);
    }

    async update(id: string, clubId: string, updateStaffDto: UpdateStaffDto): Promise<StaffMember> {
        const member = await this.findOne(id, clubId);
        Object.assign(member, updateStaffDto);
        return this.staffRepository.save(member);
    }

    async remove(id: string, clubId: string): Promise<{ success: boolean; message: string }> {
        const member = await this.findOne(id, clubId);
        await this.staffRepository.remove(member);
        return { success: true, message: 'Membre du staff supprimé avec succès' };
    }
}

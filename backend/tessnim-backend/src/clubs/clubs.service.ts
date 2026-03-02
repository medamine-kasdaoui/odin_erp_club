import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Club } from './entities/club.entity';

@Injectable()
export class ClubsService {
    constructor(
        @InjectRepository(Club)
        private clubRepository: Repository<Club>,
    ) { }

    async findAll(): Promise<Club[]> {
        return this.clubRepository.find();
    }

    async findOne(id: string): Promise<Club> {
        return this.clubRepository.findOne({ where: { id } });
    }

    async create(clubData: Partial<Club>): Promise<Club> {
        const club = this.clubRepository.create(clubData);
        return this.clubRepository.save(club);
    }

    async update(id: string, clubData: Partial<Club>): Promise<Club> {
        await this.clubRepository.update(id, clubData);
        return this.findOne(id);
    }
}

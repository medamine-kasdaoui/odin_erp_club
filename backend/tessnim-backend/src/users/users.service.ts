import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async findAll(clubId: string): Promise<User[]> {
        return this.userRepository.find({
            where: { clubId },
            relations: ['club'],
        });
    }

    async findOne(id: string, clubId: string): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { id, clubId },
            relations: ['club'],
        });
        if (!user) {
            throw new NotFoundException('Utilisateur introuvable ou accès refusé');
        }
        return user;
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { email },
            relations: ['club'],
        });
    }

    async findClubAdmins(clubId: string): Promise<User[]> {
        return this.userRepository.find({
            where: {
                clubId,
                role: UserRole.ADMIN,
            },
        });
    }

    async create(userData: Partial<User>): Promise<User> {
        const user = this.userRepository.create(userData);
        return this.userRepository.save(user);
    }

    async update(id: string, clubId: string, userData: Partial<User>): Promise<User> {
        await this.userRepository.update({ id, clubId }, userData);
        return this.findOne(id, clubId);
    }

    async updateLastLogin(id: string): Promise<void> {
        await this.userRepository.update(id, {
            lastLogin: new Date(),
        });
    }

    async delete(id: string, clubId: string): Promise<void> {
        await this.userRepository.delete({ id, clubId });
    }

    async findPendingUsers(clubId: string): Promise<User[]> {
        return this.userRepository.find({
            where: {
                clubId,
                status: 'pending' as any,
            },
            relations: ['club'],
        });
    }
}

import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SeederService.name);

    constructor(private dataSource: DataSource) { }

    async onApplicationBootstrap() {
        this.logger.log('Running dynamic database seeds...');
        try {
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();

            // Check if club already exists
            const [club] = await queryRunner.query(`SELECT id FROM clubs WHERE email = 'contact@fcodintest.ma' LIMIT 1`);

            let clubId = '11111111-1111-1111-1111-111111111111';

            if (!club) {
                await queryRunner.query(`
                    INSERT INTO clubs (id, name, status, city, country, email, created_at, updated_at)
                    VALUES (?, 'FC Odin Test', 'active', 'Casablanca', 'MAR', 'contact@fcodintest.ma', NOW(), NOW())
                `, [clubId]);
                this.logger.log('Dynamically created test Club.');
            } else {
                clubId = club.id;
            }

            // Seed Users
            const usersToSeed = [
                { id: '22222222-2222-2222-2222-222222222222', email: 'admin@club.fr', first: 'Admin', last: 'Odin', role: 'admin', type: 'staff' },
                { id: '33333333-3333-3333-3333-333333333333', email: 'coach@club.fr', first: 'Head', last: 'Coach', role: 'coach', type: 'staff' },
                { id: '44444444-4444-4444-4444-444444444444', email: 'player@club.fr', first: 'Yassine', last: 'Joueur', role: 'player', type: 'player' },
                { id: '55555555-5555-5555-5555-555555555555', email: 'medecin@club.fr', first: 'Doc', last: 'Medical', role: 'medical', type: 'staff' },
                { id: '66666666-6666-6666-6666-666666666666', email: 'finance@club.fr', first: 'Finance', last: 'Odin', role: 'accountant', type: 'staff' },
                { id: '77777777-7777-7777-7777-777777777777', email: 'scout@club.fr', first: 'Tech', last: 'Scout', role: 'scout', type: 'staff' },
            ];

            const passwordHash = '$2b$10$88Wn8HQh1yk1z.pmG9Vv1OT761oJDVpDZ775JfOCCvA32jfGNzp4.'; // password123

            for (const u of usersToSeed) {
                const [existing] = await queryRunner.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [u.email]);
                if (!existing) {
                    await queryRunner.query(`
                        INSERT INTO users (
                            id, email, password_hash, first_name, last_name, club_id, role, user_type, status, email_verified, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, NOW(), NOW())
                    `, [u.id, u.email, passwordHash, u.first, u.last, clubId, u.role, u.type]);
                    this.logger.log(`Dynamically seeded user: ${u.email}`);
                }
            }

            await queryRunner.release();
            this.logger.log('Dynamic seeding complete.');
        } catch (e) {
            this.logger.error('Error during dynamic database seeding', e);
        }
    }
}

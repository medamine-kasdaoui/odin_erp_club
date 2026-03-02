import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClubsModule } from './clubs/clubs.module';
import { CategoriesModule } from './categories/categories.module';
import { TeamsModule } from './teams/teams.module';
import { PlayersModule } from './players/players.module';
import { StaffModule } from './staff/staff.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SeederModule } from './seeder/seeder.module';
import { AiModule } from './ai/ai.module';

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        // Database
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'mysql',
                host: configService.get('DATABASE_HOST'),
                port: configService.get('DATABASE_PORT'),
                username: configService.get('DATABASE_USER'),
                password: configService.get('DATABASE_PASSWORD'),
                database: configService.get('DATABASE_NAME'),
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: configService.get('NODE_ENV') === 'development', // Only in dev!
                logging: configService.get('DATABASE_LOGGING') === 'true'
                    ? true // Logs everything (query, error, schema, etc.)
                    : ['error', 'warn'], // Clean logs: only errors and warnings
            }),
            inject: [ConfigService],
        }),

        // Module 1 — Authentification
        AuthModule,
        UsersModule,
        ClubsModule,

        // Module 2 — Gestion des Effectifs
        CategoriesModule,
        TeamsModule,
        PlayersModule,
        StaffModule,

        // Module 6 — Planification & Événements
        EventsModule,
        NotificationsModule,

        // AI Features
        AiModule,

        // Automatic Seeding
        SeederModule,
    ],
})
export class AppModule { }


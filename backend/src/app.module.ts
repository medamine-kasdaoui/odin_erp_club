import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { AnalysisModule } from './analysis/analysis.module';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';
import { ClubsModule } from './clubs/clubs.module';
import { CategoriesModule } from './categories/categories.module';
import { FinanceModule } from './finance/finance.module';
import { FileUploadModule } from './file-upload/file-upload.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { MatchesModule } from './matches/matches.module';
import { MedicalModule } from './medical/medical.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OtpModule } from './otp/otp.module';
import { PlayersModule } from './players/players.module';
import { ProvidersModule } from './providers/providers.module';
import { RbacModule } from './rbac/rbac.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReportsModule as AiReportsModule } from './reports/reports.module';
import { SimulationModule } from './simulation/simulation.module';
import { SportsPerformanceModule } from './sports-performance/sports-performance.module';
import { SquadModule } from './squad/squad.module';
import { StaffModule } from './staff/staff.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';
import { AiModule } from './ai/ai.module';
import { SeasonPlansModule } from './season-plans/season-plans.module';
import { TacticsModule } from './tactics/tactics.module';
import { ChemistryModule } from './chemistry/chemistry.module';
import { PlayerProfilesModule } from './player-profiles/player-profiles.module';
import { LearningModule } from './learning/learning.module';
import { GamificationModule } from './gamification/gamification.module';
import { TravelModule } from './travel/travel.module';
import { EventsModule } from './events/events.module';
import { LocationModule } from './location/location.module';

let memoryServer: MongoMemoryServer | null = null;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const uri = config.get<string>('MONGO_URI');
        if (uri && uri.toLowerCase() !== 'memory') {
          return { uri };
        }

        if (uri && uri.toLowerCase() === 'memory') {
          const { MongoMemoryServer } = await import('mongodb-memory-server');
          const memoryPort = Number(config.get<string>('MONGO_MEMORY_PORT', '37017'));
          memoryServer = await MongoMemoryServer.create({
            instance: {
              ip: '127.0.0.1',
              port: Number.isFinite(memoryPort) ? memoryPort : 37017,
              portGeneration: false
            }
          });
          return { uri: memoryServer.getUri() };
        }

        return { uri: 'mongodb://localhost:27017/odin_backend' };
      }
    }),
    RbacModule,
    RealtimeModule,
    OtpModule,
    AnalysisModule,
    AuditModule,
    UsersModule,
    ClubsModule,
    CategoriesModule,
    TeamsModule,
    AuthModule,
    FinanceModule,
    FileUploadModule,
    NotificationsModule,
    MessagingModule,
    CallsModule,
    PlayersModule,
    SquadModule,
    MatchesModule,
    ProvidersModule,
    IngestionModule,
    MedicalModule,
    AiModule,
    AiReportsModule,
    SimulationModule,
    SportsPerformanceModule,
    StaffModule,
    SeasonPlansModule,
    TacticsModule,
    ChemistryModule,
    PlayerProfilesModule,
    LearningModule,
    GamificationModule,
    TravelModule,
    EventsModule,
    LocationModule
  ],
  controllers: [AppController]
})
export class AppModule {}

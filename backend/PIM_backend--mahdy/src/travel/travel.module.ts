import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { TravelController } from './travel.controller';
import { TravelService } from './travel.service';
import { GeoAiService } from './services/geo-ai.service';
import { Travel, TravelSchema } from './schemas/travel.schema';
import { Club, ClubSchema } from '../clubs/schemas/club.schema';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Travel.name, schema: TravelSchema },
      { name: Club.name, schema: ClubSchema },
    ]),
    HttpModule,
    GamificationModule,
  ],
  controllers: [TravelController],
  providers: [TravelService, GeoAiService],
  exports: [TravelService],
})
export class TravelModule {}

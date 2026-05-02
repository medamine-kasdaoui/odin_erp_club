import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { GamificationProfile, GamificationProfileSchema } from './schemas/gamification-profile.schema';
import { GamificationAction, GamificationActionSchema } from './schemas/gamification-action.schema';
import { GamificationBadge, GamificationBadgeSchema } from './schemas/gamification-badge.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GamificationProfile.name, schema: GamificationProfileSchema },
      { name: GamificationAction.name, schema: GamificationActionSchema },
      { name: GamificationBadge.name, schema: GamificationBadgeSchema },
    ]),
  ],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}

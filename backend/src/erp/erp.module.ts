import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ErpPlayersController } from './erp-players.controller';
import { ErpPlayersService } from './erp-players.service';
import { ErpStaffController } from './erp-staff.controller';
import { ErpStaffService } from './erp-staff.service';
import { ErpTeamsController } from './erp-teams.controller';
import { ErpTeamsService } from './erp-teams.service';
import { ErpCategoriesController } from './erp-categories.controller';
import { ErpCategoriesService } from './erp-categories.service';
import { ErpEventsController } from './erp-events.controller';
import { ErpEventsService } from './erp-events.service';
import { ErpReadinessController } from './erp-readiness.controller';
import { ErpReadinessService } from './erp-readiness.service';
import { ErpPlayer, ErpPlayerSchema } from './schemas/erp-player.schema';
import { ErpStaffMember, ErpStaffSchema } from './schemas/erp-staff.schema';
import { ErpTeam, ErpTeamSchema } from './schemas/erp-team.schema';
import { ErpCategory, ErpCategorySchema } from './schemas/erp-category.schema';
import { ErpEvent, ErpEventSchema } from './schemas/erp-event.schema';
import { ErpEventParticipant, ErpEventParticipantSchema } from './schemas/erp-event-participant.schema';
import { ErpPlayerHistory, ErpPlayerHistorySchema } from './schemas/erp-player-history.schema';
import { ErpReadinessResult, ErpReadinessResultSchema } from './schemas/erp-readiness-result.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ErpPlayer.name, schema: ErpPlayerSchema },
      { name: ErpStaffMember.name, schema: ErpStaffSchema },
      { name: ErpTeam.name, schema: ErpTeamSchema },
      { name: ErpCategory.name, schema: ErpCategorySchema },
      { name: ErpEvent.name, schema: ErpEventSchema },
      { name: ErpEventParticipant.name, schema: ErpEventParticipantSchema },
      { name: ErpPlayerHistory.name, schema: ErpPlayerHistorySchema },
      { name: ErpReadinessResult.name, schema: ErpReadinessResultSchema }
    ])
  ],
  controllers: [
    ErpPlayersController,
    ErpStaffController,
    ErpTeamsController,
    ErpCategoriesController,
    ErpEventsController,
    ErpReadinessController
  ],
  providers: [
    ErpPlayersService,
    ErpStaffService,
    ErpTeamsService,
    ErpCategoriesService,
    ErpEventsService,
    ErpReadinessService
  ]
})
export class ErpModule {}

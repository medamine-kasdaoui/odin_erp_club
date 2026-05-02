import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventsScheduler } from './events.scheduler';
import { ErpEvent, ErpEventSchema } from './schemas/event.schema';
import { ErpEventParticipant, ErpEventParticipantSchema } from './schemas/event-participant.schema';
import { MatchLiveEvent, MatchLiveEventSchema } from './schemas/match-live-event.schema';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { LocationModule } from '../location/location.module';
import { ClubsModule } from '../clubs/clubs.module';
import { Club, ClubSchema } from '../clubs/schemas/club.schema';
import { Team, TeamSchema } from '../teams/schemas/team.schema';
import { Player, PlayerSchema } from '../players/schemas/player.schema';
import { Category, CategorySchema } from '../categories/schemas/category.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ErpEvent.name, schema: ErpEventSchema },
            { name: ErpEventParticipant.name, schema: ErpEventParticipantSchema },
            { name: MatchLiveEvent.name, schema: MatchLiveEventSchema },
            { name: Notification.name, schema: NotificationSchema },
            { name: User.name, schema: UserSchema },
            { name: Player.name, schema: PlayerSchema },
            { name: Team.name, schema: TeamSchema },
            { name: Category.name, schema: CategorySchema },
        ]),
        HttpModule,
        NotificationsModule,   // provides FcmService
        LocationModule,
        ClubsModule,
    ],
    controllers: [EventsController],
    providers: [EventsService, EventsScheduler],
    exports: [EventsService],
})
export class EventsModule {}

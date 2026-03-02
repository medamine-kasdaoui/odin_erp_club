import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event } from './entities/event.entity';
import { EventParticipant } from './entities/event-participant.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Event, EventParticipant, Notification, User])],
    controllers: [EventsController],
    providers: [EventsService],
    exports: [EventsService],
})
export class EventsModule { }

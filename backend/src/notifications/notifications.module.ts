import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RealtimeModule } from '../realtime/realtime.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { NotificationsController } from './notifications.controller';
import { NotificationsScheduler } from './notifications.scheduler';
import { NotificationsService } from './notifications.service';
import { FcmService } from './fcm.service';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import {
  ScheduledNotification,
  ScheduledNotificationSchema
} from './schemas/scheduled-notification.schema';

@Module({
  imports: [
    RealtimeModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: ScheduledNotification.name, schema: ScheduledNotificationSchema },
      { name: User.name, schema: UserSchema }
    ])
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsScheduler, FcmService],
  exports: [NotificationsService, MongooseModule, FcmService]
})
export class NotificationsModule {}

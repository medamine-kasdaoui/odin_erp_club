import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { Team, TeamSchema } from '../teams/schemas/team.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { MessagingController } from './messaging.controller';
import { MessagingEventsService } from './messaging.events.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingRedisService } from './messaging-redis.service';
import { MessagingService } from './messaging.service';
import {
  MessagingConversation,
  MessagingConversationSchema
} from './schemas/conversation.schema';
import { MessagingMessage, MessagingMessageSchema } from './schemas/message.schema';

@Module({
  imports: [
    NotificationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'change_me_jwt_secret')
      })
    }),
    MongooseModule.forFeature([
      { name: MessagingConversation.name, schema: MessagingConversationSchema },
      { name: MessagingMessage.name, schema: MessagingMessageSchema },
      { name: User.name, schema: UserSchema },
      { name: Team.name, schema: TeamSchema }
    ])
  ],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    MessagingEventsService,
    MessagingRedisService,
    MessagingGateway
  ],
  exports: [MessagingService, MessagingEventsService, MongooseModule]
})
export class MessagingModule {}

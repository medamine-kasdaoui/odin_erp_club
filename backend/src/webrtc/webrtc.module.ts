import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagingConversation, MessagingConversationSchema } from '../messaging/schemas/conversation.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { WebrtcGateway } from './webrtc.gateway';
import { WebrtcRedisService } from './webrtc-redis.service';
import { WebrtcEventsService } from './webrtc.events.service';
import { CallSession, CallSessionSchema } from './schemas/call-session.schema';
import { WebrtcService } from './webrtc.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'change_me_jwt_secret')
      })
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: MessagingConversation.name, schema: MessagingConversationSchema },
      { name: CallSession.name, schema: CallSessionSchema }
    ])
  ],
  providers: [WebrtcService, WebrtcEventsService, WebrtcRedisService, WebrtcGateway],
  exports: [WebrtcService]
})
export class WebrtcModule {}

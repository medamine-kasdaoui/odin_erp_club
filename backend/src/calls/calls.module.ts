import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import {
  MessagingConversation,
  MessagingConversationSchema,
} from "../messaging/schemas/conversation.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { CallsController } from "./calls.controller";
import { CallsEventsService } from "./calls.events.service";
import { CallsGateway } from "./calls.gateway";
import { CallsRedisService } from "./calls-redis.service";
import { CallsService } from "./calls.service";
import { CallsNotificationsService } from "./notifications.service";
import {
  CallsSession,
  CallsSessionSchema,
} from "./schemas/call-session.schema";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET", "change_me_jwt_secret"),
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: MessagingConversation.name, schema: MessagingConversationSchema },
      { name: CallsSession.name, schema: CallsSessionSchema },
    ]),
  ],
  controllers: [CallsController],
  providers: [
    CallsService,
    CallsEventsService,
    CallsRedisService,
    CallsNotificationsService,
    CallsGateway,
  ],
  exports: [CallsService],
})
export class CallsModule {}

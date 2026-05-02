import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  JoinConversationDto,
  LeaveConversationDto,
  SocketSendMessageDto,
  TypingDto
} from './dto/messaging.dto';
import { MessagingEventsService } from './messaging.events.service';
import { MessagingRedisService } from './messaging-redis.service';
import { MessagingService } from './messaging.service';

interface SocketActor extends AuthUser {
  clubId: string;
}

@WebSocketGateway({
  namespace: 'messaging',
  cors: {
    origin: true,
    credentials: true
  }
})
export class MessagingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  private readonly userConnectionCount = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly messagingService: MessagingService,
    private readonly messagingEvents: MessagingEventsService,
    private readonly messagingRedisService: MessagingRedisService
  ) {}

  async afterInit(server: Server) {
    this.messagingEvents.setServer(server);
    await this.messagingRedisService.attach(server);
  }

  async handleConnection(socket: Socket) {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        socket.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'change_me_jwt_secret')
      });

      if (!payload?.sub || !payload.clubId) {
        socket.disconnect(true);
        return;
      }

      const actor: SocketActor = {
        ...payload,
        clubId: payload.clubId
      };

      socket.data.actor = actor;
      socket.join(this.messagingEvents.userRoom(actor.sub));
      socket.join(this.messagingEvents.clubRoom(actor.clubId));

      const currentCount = this.userConnectionCount.get(actor.sub) ?? 0;
      this.userConnectionCount.set(actor.sub, currentCount + 1);

      if (currentCount === 0) {
        this.messagingEvents.emitToClub(actor.clubId, 'conversation_updated', {
          type: 'presence',
          userId: actor.sub,
          status: 'online',
          at: new Date().toISOString()
        });
      }

      socket.emit('presence_snapshot', {
        type: 'presence_snapshot',
        clubId: actor.clubId,
        onlineUserIds: this.collectOnlineUserIdsForClub(actor.clubId),
        at: new Date().toISOString()
      });
    } catch (error) {
      this.logger.warn(
        `Socket auth failed (${error instanceof Error ? error.message : 'unknown error'})`
      );
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const actor = socket.data?.actor as SocketActor | undefined;
    if (!actor?.sub || !actor.clubId) {
      return;
    }

    const currentCount = this.userConnectionCount.get(actor.sub) ?? 0;
    if (currentCount <= 1) {
      this.userConnectionCount.delete(actor.sub);
      this.messagingEvents.emitToClub(actor.clubId, 'conversation_updated', {
        type: 'presence',
        userId: actor.sub,
        status: 'offline',
        at: new Date().toISOString()
      });
      return;
    }

    this.userConnectionCount.set(actor.sub, currentCount - 1);
  }

  @SubscribeMessage('join_conversation')
  async joinConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: JoinConversationDto
  ) {
    try {
      const actor = this.requireActor(socket);
      await this.messagingService.getConversationSummaryForActor(actor, dto.conversationId);

      socket.join(this.messagingEvents.conversationRoom(dto.conversationId));
      const readResult = await this.messagingService.markConversationRead(actor, dto.conversationId);

      if (readResult.readCount > 0) {
        this.messagingEvents.emitToConversation(dto.conversationId, 'message_read', {
          conversationId: dto.conversationId,
          userId: actor.sub,
          readAt: readResult.readAt,
          readCount: readResult.readCount
        });
      }

      return {
        ok: true,
        conversationId: dto.conversationId,
        readCount: readResult.readCount
      };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('leave_conversation')
  async leaveConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: LeaveConversationDto
  ) {
    try {
      this.requireActor(socket);
      socket.leave(this.messagingEvents.conversationRoom(dto.conversationId));
      return { ok: true, conversationId: dto.conversationId };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('typing')
  async typing(@ConnectedSocket() socket: Socket, @MessageBody() dto: TypingDto) {
    try {
      const actor = this.requireActor(socket);
      await this.messagingService.getConversationSummaryForActor(actor, dto.conversationId);

      socket.to(this.messagingEvents.conversationRoom(dto.conversationId)).emit('user_typing', {
        conversationId: dto.conversationId,
        userId: actor.sub,
        isTyping: dto.isTyping ?? true,
        at: new Date().toISOString()
      });

      return { ok: true, conversationId: dto.conversationId };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('send_message')
  async sendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: SocketSendMessageDto
  ) {
    try {
      const actor = this.requireActor(socket);
      const sendResult = await this.messagingService.sendSocketMessage(actor, dto);

      this.messagingEvents.emitToConversation(sendResult.conversationId, 'new_message', {
        conversationId: sendResult.conversationId,
        message: sendResult.message
      });

      const actorConversation = await this.messagingService.getConversationSummaryForActor(
        actor,
        sendResult.conversationId
      );

      this.messagingEvents.emitToUsers(sendResult.participantUserIds, 'conversation_updated', {
        conversation: actorConversation,
        updatedBy: actor.sub,
        updatedAt: new Date().toISOString()
      });

      return {
        ok: true,
        conversationId: sendResult.conversationId,
        messageId: sendResult.message.id
      };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  private requireActor(socket: Socket): SocketActor {
    const actor = socket.data?.actor as SocketActor | undefined;
    if (!actor?.sub || !actor.clubId) {
      throw new WsException('Unauthorized socket');
    }

    return actor;
  }

  private extractToken(socket: Socket) {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const authorizationHeader = socket.handshake.headers?.authorization;
    if (typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')) {
      return authorizationHeader.slice('Bearer '.length).trim();
    }

    return null;
  }

  private collectOnlineUserIdsForClub(clubId: string) {
    const onlineUserIds = new Set<string>();
    for (const connectedSocket of this.server.sockets.sockets.values()) {
      const actor = connectedSocket.data?.actor as SocketActor | undefined;
      if (!actor?.sub || actor.clubId !== clubId) {
        continue;
      }
      onlineUserIds.add(actor.sub);
    }
    return Array.from(onlineUserIds);
  }

  private toWsError(error: unknown) {
    if (error instanceof WsException) {
      return error;
    }

    if (error instanceof Error) {
      return new WsException(error.message);
    }

    return new WsException('Unexpected websocket error');
  }
}

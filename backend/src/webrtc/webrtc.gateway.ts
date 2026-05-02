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
  AcceptCallDto,
  CallUserDto,
  EndCallDto,
  IceCandidateDto,
  RejectCallDto,
  WebrtcAnswerDto,
  WebrtcOfferDto
} from './dto/webrtc.dto';
import { WebrtcEventsService } from './webrtc.events.service';
import { WebrtcRedisService } from './webrtc-redis.service';
import { WebrtcActorContext } from './webrtc.types';
import { WebrtcService } from './webrtc.service';

@WebSocketGateway({
  namespace: 'webrtc',
  cors: {
    origin: true,
    credentials: true
  }
})
export class WebrtcGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebrtcGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly webrtcService: WebrtcService,
    private readonly webrtcEvents: WebrtcEventsService,
    private readonly webrtcRedisService: WebrtcRedisService
  ) {}

  async afterInit(server: Server) {
    this.webrtcEvents.setServer(server);
    await this.webrtcRedisService.attach(server);
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

      const actor = await this.webrtcService.resolveActorFromJwtPayload(payload);

      socket.data.actor = actor;
      socket.join(this.webrtcEvents.userRoom(actor.userId));
      socket.join(this.webrtcEvents.clubRoom(actor.clubId));

      this.webrtcService.registerSocketConnection(actor.userId, socket.id);
    } catch (error) {
      this.logger.warn(
        `WebRTC socket auth failed (${error instanceof Error ? error.message : 'unknown error'})`
      );
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const actor = socket.data?.actor as WebrtcActorContext | undefined;
    if (!actor?.userId) {
      return;
    }

    this.webrtcService.unregisterSocketConnection(actor.userId, socket.id);

    const stillConnectedSockets = await this.server
      .in(this.webrtcEvents.userRoom(actor.userId))
      .fetchSockets();

    if (stillConnectedSockets.length > 0) {
      return;
    }

    const endedSessions = await this.webrtcService.endCallsForDisconnectedUser(actor.userId);
    for (const session of endedSessions) {
      this.webrtcEvents.emitToUsers([session.callerId, session.receiverId], 'call_ended', {
        callId: session.id,
        conversationId: session.conversationId,
        reason: 'disconnected',
        endedBy: actor.userId,
        endedAt: session.endedAt
      });
    }
  }

  @SubscribeMessage('call_user')
  async callUser(@ConnectedSocket() socket: Socket, @MessageBody() dto: CallUserDto) {
    try {
      const actor = this.requireActor(socket);
      const result = await this.webrtcService.initiateCall(actor, dto);

      this.webrtcEvents.emitToUser(result.receiver.userId, 'incoming_call', {
        callId: result.session.id,
        conversationId: result.session.conversationId,
        type: result.session.type,
        from: result.caller,
        toUserId: result.receiver.userId,
        startedAt: result.session.startedAt
      });

      return {
        ok: true,
        callId: result.session.id,
        status: result.session.status,
        conversationId: result.session.conversationId,
        startedAt: result.session.startedAt
      };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('accept_call')
  async acceptCall(@ConnectedSocket() socket: Socket, @MessageBody() dto: AcceptCallDto) {
    try {
      const actor = this.requireActor(socket);
      const session = await this.webrtcService.acceptCall(actor, dto.callId);

      this.webrtcEvents.emitToUsers([session.callerId, session.receiverId], 'call_accepted', {
        callId: session.id,
        conversationId: session.conversationId,
        acceptedBy: actor.userId,
        acceptedAt: session.acceptedAt,
        type: session.type
      });

      return {
        ok: true,
        callId: session.id,
        status: session.status,
        acceptedAt: session.acceptedAt
      };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('reject_call')
  async rejectCall(@ConnectedSocket() socket: Socket, @MessageBody() dto: RejectCallDto) {
    try {
      const actor = this.requireActor(socket);
      const session = await this.webrtcService.rejectCall(actor, dto.callId, dto.reason);

      this.webrtcEvents.emitToUsers([session.callerId, session.receiverId], 'call_rejected', {
        callId: session.id,
        conversationId: session.conversationId,
        rejectedBy: actor.userId,
        reason: session.endReason ?? dto.reason ?? 'rejected',
        endedAt: session.endedAt
      });

      return {
        ok: true,
        callId: session.id,
        status: session.status,
        reason: session.endReason
      };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('end_call')
  async endCall(@ConnectedSocket() socket: Socket, @MessageBody() dto: EndCallDto) {
    try {
      const actor = this.requireActor(socket);
      const session = await this.webrtcService.endCall(actor, dto.callId, dto.reason);

      this.webrtcEvents.emitToUsers([session.callerId, session.receiverId], 'call_ended', {
        callId: session.id,
        conversationId: session.conversationId,
        reason: session.endReason,
        endedBy: actor.userId,
        endedAt: session.endedAt
      });

      return {
        ok: true,
        callId: session.id,
        status: session.status,
        reason: session.endReason
      };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('webrtc_offer')
  async relayOffer(@ConnectedSocket() socket: Socket, @MessageBody() dto: WebrtcOfferDto) {
    try {
      const actor = this.requireActor(socket);
      const relay = await this.webrtcService.relayOffer(actor, dto.callId);

      this.webrtcEvents.emitToUser(relay.toUserId, 'webrtc_offer', {
        callId: relay.session.id,
        conversationId: relay.session.conversationId,
        fromUserId: relay.fromUserId,
        sdp: dto.sdp
      });

      return { ok: true, callId: relay.session.id };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('webrtc_answer')
  async relayAnswer(@ConnectedSocket() socket: Socket, @MessageBody() dto: WebrtcAnswerDto) {
    try {
      const actor = this.requireActor(socket);
      const relay = await this.webrtcService.relayAnswer(actor, dto.callId);

      this.webrtcEvents.emitToUser(relay.toUserId, 'webrtc_answer', {
        callId: relay.session.id,
        conversationId: relay.session.conversationId,
        fromUserId: relay.fromUserId,
        sdp: dto.sdp
      });

      return { ok: true, callId: relay.session.id };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage('ice_candidate')
  async relayIceCandidate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: IceCandidateDto
  ) {
    try {
      const actor = this.requireActor(socket);
      const relay = await this.webrtcService.relayIceCandidate(actor, dto.callId);

      this.webrtcEvents.emitToUser(relay.toUserId, 'ice_candidate', {
        callId: relay.session.id,
        conversationId: relay.session.conversationId,
        fromUserId: relay.fromUserId,
        candidate: dto.candidate
      });

      return { ok: true, callId: relay.session.id };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  private requireActor(socket: Socket): WebrtcActorContext {
    const actor = socket.data?.actor as WebrtcActorContext | undefined;
    if (!actor?.userId || !actor.clubId) {
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
      return authorizationHeader.slice(7).trim();
    }

    const queryToken = socket.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim();
    }

    return null;
  }

  private toWsError(error: unknown): WsException {
    if (error instanceof WsException) {
      return error;
    }

    if (error instanceof Error) {
      return new WsException(error.message);
    }

    return new WsException('WebRTC socket request failed');
  }
}

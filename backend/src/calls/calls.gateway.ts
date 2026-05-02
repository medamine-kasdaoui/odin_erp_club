import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import {
  AcceptCallDto,
  CallUserDto,
  EndCallDto,
  IceCandidateDto,
  MuteAllParticipantsDto,
  RejectCallDto,
  WebrtcAnswerDto,
  WebrtcOfferDto,
} from "./dto/calls.dto";
import { CallsEventsService } from "./calls.events.service";
import { CallsRedisService } from "./calls-redis.service";
import { CallsActorContext } from "./calls.types";
import { CallsService } from "./calls.service";

@WebSocketGateway({
  // Keep legacy namespace so existing mobile clients continue to work.
  namespace: "webrtc",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class CallsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CallsGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly callsService: CallsService,
    private readonly callsEvents: CallsEventsService,
    private readonly callsRedisService: CallsRedisService,
  ) {}

  async afterInit(server: Server) {
    this.callsEvents.setServer(server);
    await this.callsRedisService.attach(server);
  }

  async handleConnection(socket: Socket) {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        socket.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: this.configService.get<string>(
          "JWT_SECRET",
          "change_me_jwt_secret",
        ),
      });

      const actor = await this.callsService.resolveActorFromJwtPayload(payload);

      socket.data.actor = actor;
      socket.join(this.callsEvents.userRoom(actor.userId));
      socket.join(this.callsEvents.clubRoom(actor.clubId));

      this.callsService.registerSocketConnection(actor.userId, socket.id);
    } catch (error) {
      this.logger.warn(
        `Calls socket auth failed (${error instanceof Error ? error.message : "unknown error"})`,
      );
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const actor = socket.data?.actor as CallsActorContext | undefined;
    if (!actor?.userId) {
      return;
    }

    this.callsService.unregisterSocketConnection(actor.userId, socket.id);

    const stillConnectedSockets = await this.server
      .in(this.callsEvents.userRoom(actor.userId))
      .fetchSockets();

    if (stillConnectedSockets.length > 0) {
      return;
    }

    const disconnectResult =
      await this.callsService.endCallsForDisconnectedUser(actor.userId);

    for (const session of disconnectResult.ended) {
      this.callsEvents.emitToUsers(session.participants, "call_ended", {
        callId: session.id,
        conversationId: session.conversationId,
        channelId: session.channelId,
        reason: session.endReason ?? "disconnected",
        endedBy: actor.userId,
        endedAt: session.endedAt,
      });
    }

    for (const update of disconnectResult.presenceUpdates) {
      this.callsEvents.emitToConversation(
        update.conversationId,
        "conversation_updated",
        {
          type: "call_presence",
          callId: update.callId,
          conversationId: update.conversationId,
          userId: update.changedUserId,
          action: "left",
          at: new Date().toISOString(),
        },
      );
    }
  }

  @SubscribeMessage("call_user")
  async callUser(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: CallUserDto,
  ) {
    try {
      const actor = this.requireActor(socket);
      const result = await this.callsService.initiateCall(actor, dto);

      for (const invitee of result.invitedUsers) {
        const tokenForInvitee = result.invitedTokens.find(
          (entry) => entry.userId === invitee.userId,
        );

        this.callsEvents.emitToUser(invitee.userId, "incoming_call", {
          callId: result.session.id,
          conversationId: result.session.conversationId,
          channelId: result.session.channelId,
          type: result.session.mediaType,
          mediaType: result.session.mediaType,
          sessionType: result.session.sessionType,
          from: result.caller,
          hostUserId: result.session.hostUserId,
          token: tokenForInvitee?.token ?? null,
          startedAt: result.session.startedAt,
          timeoutAt: result.session.timeoutAt,
        });
      }

      return {
        ok: true,
        callId: result.session.id,
        conversationId: result.session.conversationId,
        channelId: result.session.channelId,
        type: result.session.mediaType,
        mediaType: result.session.mediaType,
        sessionType: result.session.sessionType,
        token: result.callerToken,
        invitedUsers: result.invitedUsers,
        skippedBusyUserIds: result.skippedBusyUserIds,
        status: result.session.status,
        startedAt: result.session.startedAt,
        timeoutAt: result.session.timeoutAt,
      };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage("accept_call")
  async acceptCall(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: AcceptCallDto,
  ) {
    try {
      const actor = this.requireActor(socket);
      const result = await this.callsService.acceptCall(actor, dto);

      this.callsEvents.emitToUsers(
        result.session.participants,
        "call_accepted",
        {
          callId: result.session.id,
          conversationId: result.session.conversationId,
          channelId: result.session.channelId,
          type: result.session.mediaType,
          acceptedBy: actor.userId,
          acceptedAt: result.session.acceptedAt,
          mediaType: result.session.mediaType,
          sessionType: result.session.sessionType,
          acceptedUserIds: result.session.acceptedUserIds,
        },
      );

      return {
        ok: true,
        callId: result.session.id,
        status: result.session.status,
        token: result.token,
      };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage("reject_call")
  async rejectCall(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: RejectCallDto,
  ) {
    try {
      const actor = this.requireActor(socket);
      const session = await this.callsService.rejectCall(
        actor,
        dto.callId,
        dto.reason,
      );

      if (session.status === "ended") {
        this.callsEvents.emitToUsers(session.participants, "call_rejected", {
          callId: session.id,
          conversationId: session.conversationId,
          reason: session.endReason ?? dto.reason ?? "rejected",
          rejectedBy: actor.userId,
          endedAt: session.endedAt,
        });

        this.callsEvents.emitToUsers(session.participants, "call_ended", {
          callId: session.id,
          conversationId: session.conversationId,
          channelId: session.channelId,
          reason: session.endReason ?? "rejected",
          endedBy: actor.userId,
          endedAt: session.endedAt,
        });
      } else {
        this.callsEvents.emitToConversation(
          session.conversationId,
          "conversation_updated",
          {
            type: "call_presence",
            callId: session.id,
            conversationId: session.conversationId,
            userId: actor.userId,
            action: "rejected",
            at: new Date().toISOString(),
          },
        );
      }

      return {
        ok: true,
        callId: session.id,
        status: session.status,
        reason: session.endReason ?? dto.reason ?? "rejected",
      };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage("end_call")
  async endCall(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: EndCallDto,
  ) {
    try {
      const actor = this.requireActor(socket);
      const result = await this.callsService.endCall(actor, dto);

      if (result.endedForAll) {
        this.callsEvents.emitToUsers(
          result.session.participants,
          "call_ended",
          {
            callId: result.session.id,
            conversationId: result.session.conversationId,
            channelId: result.session.channelId,
            reason: result.session.endReason ?? dto.reason ?? "completed",
            endedBy: actor.userId,
            endedAt: result.session.endedAt,
          },
        );

        return {
          ok: true,
          callId: result.session.id,
          endedForAll: true,
          status: result.session.status,
          reason: result.session.endReason,
        };
      }

      this.callsEvents.emitToUser(actor.userId, "call_ended", {
        callId: result.session.id,
        conversationId: result.session.conversationId,
        channelId: result.session.channelId,
        reason: "left",
        endedBy: actor.userId,
        endedAt: new Date().toISOString(),
      });

      this.callsEvents.emitToConversation(
        result.session.conversationId,
        "conversation_updated",
        {
          type: "call_presence",
          callId: result.session.id,
          conversationId: result.session.conversationId,
          userId: actor.userId,
          action: "left",
          at: new Date().toISOString(),
        },
      );

      return {
        ok: true,
        callId: result.session.id,
        endedForAll: false,
        status: result.session.status,
        leftUserId: actor.userId,
      };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage("mute_all_participants")
  async muteAllParticipants(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: MuteAllParticipantsDto,
  ) {
    try {
      const actor = this.requireActor(socket);
      const result = await this.callsService.muteAllParticipants(actor, dto);

      this.callsEvents.emitToConversation(
        result.session.conversationId,
        "conversation_updated",
        {
          type: "call_mute_all",
          callId: result.session.id,
          conversationId: result.session.conversationId,
          muted: result.muted,
          updatedBy: actor.userId,
          at: new Date().toISOString(),
        },
      );

      return {
        ok: true,
        callId: result.session.id,
        muted: result.muted,
      };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage("webrtc_offer")
  async relayOffer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: WebrtcOfferDto,
  ) {
    try {
      const actor = this.requireActor(socket);
      const relay = await this.callsService.relayOffer(actor, dto.callId);

      this.callsEvents.emitToUsers(relay.toUserIds, "webrtc_offer", {
        callId: relay.session.id,
        conversationId: relay.session.conversationId,
        channelId: relay.session.channelId,
        fromUserId: relay.fromUserId,
        sdp: dto.sdp,
      });

      return { ok: true, callId: relay.session.id };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage("webrtc_answer")
  async relayAnswer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: WebrtcAnswerDto,
  ) {
    try {
      const actor = this.requireActor(socket);
      const relay = await this.callsService.relayAnswer(actor, dto.callId);

      this.callsEvents.emitToUsers(relay.toUserIds, "webrtc_answer", {
        callId: relay.session.id,
        conversationId: relay.session.conversationId,
        channelId: relay.session.channelId,
        fromUserId: relay.fromUserId,
        sdp: dto.sdp,
      });

      return { ok: true, callId: relay.session.id };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  @SubscribeMessage("ice_candidate")
  async relayIceCandidate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: IceCandidateDto,
  ) {
    try {
      const actor = this.requireActor(socket);
      const relay = await this.callsService.relayIceCandidate(
        actor,
        dto.callId,
      );

      this.callsEvents.emitToUsers(relay.toUserIds, "ice_candidate", {
        callId: relay.session.id,
        conversationId: relay.session.conversationId,
        channelId: relay.session.channelId,
        fromUserId: relay.fromUserId,
        candidate: dto.candidate,
      });

      return { ok: true, callId: relay.session.id };
    } catch (error) {
      throw this.toWsError(error);
    }
  }

  private requireActor(socket: Socket): CallsActorContext {
    const actor = socket.data?.actor as CallsActorContext | undefined;
    if (!actor?.userId || !actor.clubId) {
      throw new WsException("Unauthorized socket");
    }

    return actor;
  }

  private extractToken(socket: Socket) {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.trim()) {
      return authToken.trim();
    }

    const authorizationHeader = socket.handshake.headers?.authorization;
    if (
      typeof authorizationHeader === "string" &&
      authorizationHeader.startsWith("Bearer ")
    ) {
      return authorizationHeader.slice(7).trim();
    }

    const queryToken = socket.handshake.query?.token;
    if (typeof queryToken === "string" && queryToken.trim()) {
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

    return new WsException("Calls socket request failed");
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ROLE_PERMISSIONS } from '../common/constants/role-permissions.constant';
import { Permission } from '../common/enums/permission.enum';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { MessagingConversation, MessagingConversationDocument } from '../messaging/schemas/conversation.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CallUserDto } from './dto/webrtc.dto';
import { CallSession, CallSessionDocument } from './schemas/call-session.schema';
import { WebrtcEventsService } from './webrtc.events.service';
import {
  ActiveCallSession,
  CallPartySummary,
  SignalingRelayTarget,
  WebrtcActorContext,
  WebrtcCallStatus,
  WebrtcEndReason
} from './webrtc.types';

interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  srem(key: string, ...members: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<unknown>;
  quit?: () => Promise<unknown>;
  disconnect?: () => void;
}

@Injectable()
export class WebrtcService implements OnModuleDestroy {
  private readonly logger = new Logger(WebrtcService.name);
  private readonly activeSessions = new Map<string, ActiveCallSession>();
  private readonly userToLocalSockets = new Map<string, Set<string>>();
  private readonly ringingTimers = new Map<string, NodeJS.Timeout>();

  private redisClient: RedisClientLike | null = null;
  private redisChecked = false;

  private readonly ringTimeoutMs: number;
  private readonly sessionTtlSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly webrtcEvents: WebrtcEventsService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(MessagingConversation.name)
    private readonly conversationModel: Model<MessagingConversationDocument>,
    @InjectModel(CallSession.name)
    private readonly callSessionModel: Model<CallSessionDocument>
  ) {
    this.ringTimeoutMs = this.normalizeInt(
      Number(this.configService.get<string>('WEBRTC_RING_TIMEOUT_MS', '30000')),
      30000,
      5000,
      120000
    );
    this.sessionTtlSeconds = this.normalizeInt(
      Number(this.configService.get<string>('WEBRTC_SESSION_TTL_SECONDS', '43200')),
      43200,
      300,
      172800
    );
  }

  async onModuleDestroy() {
    for (const timer of this.ringingTimers.values()) {
      clearTimeout(timer);
    }
    this.ringingTimers.clear();

    if (this.redisClient?.quit) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient?.disconnect?.();
      }
    } else {
      this.redisClient?.disconnect?.();
    }
  }

  async resolveActorFromJwtPayload(payload: AuthUser): Promise<WebrtcActorContext> {
    return this.resolveActorContext(payload);
  }

  registerSocketConnection(userId: string, socketId: string) {
    let sockets = this.userToLocalSockets.get(userId);
    if (!sockets) {
      sockets = new Set<string>();
      this.userToLocalSockets.set(userId, sockets);
    }
    sockets.add(socketId);
  }

  unregisterSocketConnection(userId: string, socketId: string) {
    const sockets = this.userToLocalSockets.get(userId);
    if (!sockets) {
      return 0;
    }

    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.userToLocalSockets.delete(userId);
      return 0;
    }

    return sockets.size;
  }

  async initiateCall(actor: AuthUser | WebrtcActorContext, dto: CallUserDto) {
    const caller = await this.asActorContext(actor);
    this.ensureCallPermission(caller.role);

    if (dto.targetUserId === caller.userId) {
      throw new BadRequestException('Cannot call yourself');
    }

    const targetUser = await this.findUserInClub(caller.clubId, dto.targetUserId);
    const enforceSameTeam = this.isSameTeamRequired(dto.sameTeamOnly === true);

    if (enforceSameTeam) {
      if (!caller.teamId || !targetUser.teamId || caller.teamId !== targetUser.teamId) {
        throw new ForbiddenException('Calls are restricted to members of the same team');
      }
    }

    const conversation = await this.getConversationForOneToOneCall({
      conversationId: dto.conversationId,
      clubId: caller.clubId,
      callerId: caller.userId,
      targetUserId: dto.targetUserId,
      enforceSameTeam,
      callerTeamId: caller.teamId
    });

    await this.ensureUsersNotBusy(caller.clubId, [caller.userId, dto.targetUserId]);

    const nowIso = new Date().toISOString();
    const session: ActiveCallSession = {
      id: uuidv4(),
      clubId: caller.clubId,
      conversationId: String(conversation._id),
      callerId: caller.userId,
      receiverId: dto.targetUserId,
      type: dto.type,
      status: 'ringing',
      startedAt: nowIso,
      acceptedAt: null,
      endedAt: null,
      endReason: null
    };

    await this.persistActiveSession(session);

    await this.callSessionModel.create({
      callId: session.id,
      clubId: new Types.ObjectId(session.clubId),
      conversationId: new Types.ObjectId(session.conversationId),
      callerId: new Types.ObjectId(session.callerId),
      receiverId: new Types.ObjectId(session.receiverId),
      type: session.type,
      status: session.status,
      startedAt: new Date(session.startedAt),
      metadata: {}
    });

    this.scheduleRingTimeout(session.id);

    return {
      session,
      caller: this.toPartySummaryFromActor(caller),
      receiver: this.toPartySummaryFromUser(targetUser)
    };
  }

  async acceptCall(actor: AuthUser | WebrtcActorContext, callId: string) {
    const receiver = await this.asActorContext(actor);
    const session = await this.requireActiveSession(callId);

    this.assertActorWithinSession(receiver, session);
    if (session.receiverId !== receiver.userId) {
      throw new ForbiddenException('Only the called user can accept this call');
    }

    if (session.status !== 'ringing') {
      throw new ConflictException('Call is no longer ringing');
    }

    const acceptedAt = new Date().toISOString();
    const updated: ActiveCallSession = {
      ...session,
      status: 'active',
      acceptedAt
    };

    this.clearRingTimeout(callId);
    await this.persistActiveSession(updated);

    await this.callSessionModel.updateOne(
      { callId: session.id },
      {
        $set: {
          status: 'active',
          acceptedAt: new Date(acceptedAt)
        }
      }
    );

    return updated;
  }

  async rejectCall(actor: AuthUser | WebrtcActorContext, callId: string, reason?: WebrtcEndReason) {
    const receiver = await this.asActorContext(actor);
    const session = await this.requireActiveSession(callId);

    this.assertActorWithinSession(receiver, session);
    if (session.receiverId !== receiver.userId) {
      throw new ForbiddenException('Only the called user can reject this call');
    }

    if (session.status !== 'ringing') {
      throw new ConflictException('Only ringing calls can be rejected');
    }

    return this.finishCallSession(
      session,
      reason && reason !== 'timeout' ? reason : 'rejected',
      receiver.userId
    );
  }

  async endCall(actor: AuthUser | WebrtcActorContext, callId: string, reason?: WebrtcEndReason) {
    const participant = await this.asActorContext(actor);
    const session = await this.requireActiveSession(callId);

    this.assertActorWithinSession(participant, session);

    const computedReason =
      reason ?? (session.status === 'ringing' ? 'cancelled' : 'completed');

    return this.finishCallSession(session, computedReason, participant.userId);
  }

  async relayOffer(actor: AuthUser | WebrtcActorContext, callId: string): Promise<SignalingRelayTarget> {
    return this.relaySignal(actor, callId);
  }

  async relayAnswer(actor: AuthUser | WebrtcActorContext, callId: string): Promise<SignalingRelayTarget> {
    return this.relaySignal(actor, callId);
  }

  async relayIceCandidate(actor: AuthUser | WebrtcActorContext, callId: string): Promise<SignalingRelayTarget> {
    return this.relaySignal(actor, callId);
  }

  async endCallsForDisconnectedUser(userId: string) {
    const callIds = await this.getActiveCallIdsForUser(userId);
    const ended: ActiveCallSession[] = [];

    for (const callId of callIds) {
      const session = await this.getActiveSession(callId);
      if (!session) {
        continue;
      }

      if (session.status === 'ended') {
        continue;
      }

      if (session.callerId !== userId && session.receiverId !== userId) {
        continue;
      }

      ended.push(await this.finishCallSession(session, 'disconnected', userId));
    }

    return ended;
  }

  async getCallSession(callId: string) {
    return this.getActiveSession(callId);
  }

  private async relaySignal(
    actor: AuthUser | WebrtcActorContext,
    callId: string
  ): Promise<SignalingRelayTarget> {
    const participant = await this.asActorContext(actor);
    const session = await this.requireActiveSession(callId);

    this.assertActorWithinSession(participant, session);

    if (session.status === 'ended') {
      throw new ConflictException('Call has already ended');
    }

    const targetUserId =
      session.callerId === participant.userId ? session.receiverId : session.callerId;

    return {
      session,
      fromUserId: participant.userId,
      toUserId: targetUserId
    };
  }

  private async finishCallSession(
    session: ActiveCallSession,
    reason: WebrtcEndReason,
    _endedByUserId: string | null
  ) {
    if (session.status === 'ended') {
      return session;
    }

    const endedAt = new Date().toISOString();
    const updated: ActiveCallSession = {
      ...session,
      status: 'ended',
      endReason: reason,
      endedAt
    };

    this.clearRingTimeout(session.id);

    await this.callSessionModel.updateOne(
      { callId: session.id },
      {
        $set: {
          status: 'ended',
          endedAt: new Date(endedAt),
          endReason: reason
        }
      }
    );

    await this.removeActiveSession(updated);

    return updated;
  }

  private assertActorWithinSession(actor: WebrtcActorContext, session: ActiveCallSession) {
    if (actor.clubId !== session.clubId) {
      throw new ForbiddenException('Cross-club call access is not allowed');
    }

    if (session.callerId !== actor.userId && session.receiverId !== actor.userId) {
      throw new ForbiddenException('You are not part of this call session');
    }
  }

  private async requireActiveSession(callId: string) {
    const session = await this.getActiveSession(callId);
    if (!session) {
      throw new NotFoundException('Call session not found or already ended');
    }

    return session;
  }

  private async persistActiveSession(session: ActiveCallSession) {
    this.activeSessions.set(session.id, session);

    const redis = await this.getRedisClient();
    if (!redis) {
      return;
    }

    const serialized = JSON.stringify(session);
    await redis.set(this.sessionKey(session.id), serialized, 'EX', this.sessionTtlSeconds);

    await redis.sadd(this.userSessionsKey(session.callerId), session.id);
    await redis.expire(this.userSessionsKey(session.callerId), this.sessionTtlSeconds);

    await redis.sadd(this.userSessionsKey(session.receiverId), session.id);
    await redis.expire(this.userSessionsKey(session.receiverId), this.sessionTtlSeconds);
  }

  private async removeActiveSession(session: ActiveCallSession) {
    this.activeSessions.delete(session.id);

    const redis = await this.getRedisClient();
    if (!redis) {
      return;
    }

    await redis.del(this.sessionKey(session.id));
    await redis.srem(this.userSessionsKey(session.callerId), session.id);
    await redis.srem(this.userSessionsKey(session.receiverId), session.id);
  }

  private async getActiveSession(callId: string): Promise<ActiveCallSession | null> {
    const local = this.activeSessions.get(callId);
    if (local) {
      return local;
    }

    const redis = await this.getRedisClient();
    if (!redis) {
      return null;
    }

    const raw = await redis.get(this.sessionKey(callId));
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as ActiveCallSession;
      if (!parsed?.id || parsed.id !== callId) {
        return null;
      }
      this.activeSessions.set(callId, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  private async getActiveCallIdsForUser(userId: string) {
    const ids = new Set<string>();

    for (const [callId, session] of this.activeSessions.entries()) {
      if (session.callerId === userId || session.receiverId === userId) {
        ids.add(callId);
      }
    }

    const redis = await this.getRedisClient();
    if (redis) {
      const remoteIds = await redis.smembers(this.userSessionsKey(userId));
      for (const callId of remoteIds) {
        ids.add(callId);
      }
    }

    return [...ids];
  }

  private scheduleRingTimeout(callId: string) {
    this.clearRingTimeout(callId);

    const timer = setTimeout(() => {
      void this.timeoutRingingCall(callId);
    }, this.ringTimeoutMs);

    this.ringingTimers.set(callId, timer);
  }

  private clearRingTimeout(callId: string) {
    const timer = this.ringingTimers.get(callId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.ringingTimers.delete(callId);
  }

  private async timeoutRingingCall(callId: string) {
    try {
      const session = await this.getActiveSession(callId);
      if (!session || session.status !== 'ringing') {
        return;
      }

      const ended = await this.finishCallSession(session, 'timeout', null);
      this.webrtcEvents.emitToUsers([ended.callerId, ended.receiverId], 'call_ended', {
        callId: ended.id,
        conversationId: ended.conversationId,
        reason: 'timeout',
        endedBy: null,
        endedAt: ended.endedAt
      });
    } catch (error) {
      this.logger.warn(
        `Failed to timeout call ${callId} (${error instanceof Error ? error.message : 'unknown error'})`
      );
    }
  }

  private async getRedisClient(): Promise<RedisClientLike | null> {
    if (this.redisChecked) {
      return this.redisClient;
    }

    this.redisChecked = true;

    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = Number(this.configService.get<string>('REDIS_PORT', '6379'));

    if (!redisUrl && !redisHost) {
      this.logger.log('Redis session store disabled for WebRTC (no REDIS_URL/REDIS_HOST)');
      return null;
    }

    try {
      // Loaded dynamically so local setups can run without Redis.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require('ioredis');
      this.redisClient = redisUrl
        ? new Redis(redisUrl)
        : new Redis({ host: redisHost, port: Number.isFinite(redisPort) ? redisPort : 6379 });
      return this.redisClient;
    } catch (error) {
      this.logger.warn(
        `WebRTC Redis session store unavailable (${error instanceof Error ? error.message : 'unknown error'})`
      );
      this.redisClient = null;
      return null;
    }
  }

  private async resolveActorContext(actor: AuthUser): Promise<WebrtcActorContext> {
    if (!actor.clubId) {
      throw new ForbiddenException('Club-scoped access is required for calling');
    }

    const actorObjectId = this.toObjectId(actor.sub, 'actor user id');
    const clubObjectId = this.toObjectId(actor.clubId, 'actor club id');

    const user = await this.userModel
      .findOne({
        _id: actorObjectId,
        clubId: clubObjectId,
        status: UserStatus.ACTIVE
      })
      .select('_id email role clubId teamId firstName lastName')
      .lean();

    if (!user) {
      throw new ForbiddenException('Active user not found in your club scope');
    }

    return {
      userId: String(user._id),
      email: user.email,
      role: user.role,
      clubId: String(user.clubId),
      teamId: user.teamId ? String(user.teamId) : null,
      firstName: user.firstName,
      lastName: user.lastName
    };
  }

  private async asActorContext(actor: AuthUser | WebrtcActorContext) {
    const actorContext = actor as WebrtcActorContext;
    if (actorContext.userId && actorContext.clubId) {
      return actorContext;
    }

    return this.resolveActorContext(actor as AuthUser);
  }

  private ensureCallPermission(role: Role) {
    const permissions = ROLE_PERMISSIONS[role] ?? [];
    if (!permissions.includes(Permission.CHAT_WRITE)) {
      throw new ForbiddenException('Your role is not allowed to place calls');
    }
  }

  private async findUserInClub(clubId: string, userId: string) {
    const userObjectId = this.toObjectId(userId, 'targetUserId');
    const clubObjectId = this.toObjectId(clubId, 'clubId');

    const user = await this.userModel
      .findOne({ _id: userObjectId, clubId: clubObjectId, status: UserStatus.ACTIVE })
      .select('_id firstName lastName role teamId')
      .lean();

    if (!user) {
      throw new ForbiddenException('Target user is outside your club scope or inactive');
    }

    return {
      userId: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      teamId: user.teamId ? String(user.teamId) : null
    };
  }

  private async getConversationForOneToOneCall(params: {
    conversationId: string;
    clubId: string;
    callerId: string;
    targetUserId: string;
    enforceSameTeam: boolean;
    callerTeamId: string | null;
  }) {
    const conversation = await this.conversationModel
      .findOne({
        _id: this.toObjectId(params.conversationId, 'conversationId'),
        clubId: this.toObjectId(params.clubId, 'clubId'),
        participants: {
          $all: [
            this.toObjectId(params.callerId, 'callerId'),
            this.toObjectId(params.targetUserId, 'targetUserId')
          ]
        }
      })
      .select('_id clubId teamId participants')
      .lean();

    if (!conversation) {
      throw new ForbiddenException('Conversation does not include both call participants');
    }

    if (params.enforceSameTeam) {
      if (conversation.teamId && (!params.callerTeamId || String(conversation.teamId) !== params.callerTeamId)) {
        throw new ForbiddenException('Conversation is outside your team scope');
      }
    }

    return conversation;
  }

  private async ensureUsersNotBusy(clubId: string, userIds: string[]) {
    const userObjectIds = userIds.map((id) => this.toObjectId(id, 'userId'));
    const busy = await this.callSessionModel
      .findOne({
        clubId: this.toObjectId(clubId, 'clubId'),
        status: { $in: ['ringing', 'active'] as WebrtcCallStatus[] },
        endedAt: null,
        $or: [{ callerId: { $in: userObjectIds } }, { receiverId: { $in: userObjectIds } }]
      })
      .select('callId status')
      .lean();

    if (busy) {
      throw new ConflictException('One of the users is already in another call');
    }
  }

  private toPartySummaryFromActor(actor: WebrtcActorContext): CallPartySummary {
    return {
      userId: actor.userId,
      firstName: actor.firstName,
      lastName: actor.lastName,
      role: actor.role,
      teamId: actor.teamId
    };
  }

  private toPartySummaryFromUser(user: {
    userId: string;
    firstName: string;
    lastName: string;
    role: Role;
    teamId: string | null;
  }): CallPartySummary {
    return {
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      teamId: user.teamId
    };
  }

  private toObjectId(raw: string, field: string) {
    if (!Types.ObjectId.isValid(raw)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return new Types.ObjectId(raw);
  }

  private normalizeInt(value: number, fallback: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(Math.max(Math.round(value), min), max);
  }

  private isSameTeamRequired(requestedSameTeamOnly: boolean) {
    if (requestedSameTeamOnly) {
      return true;
    }

    return this.configService.get<string>('WEBRTC_REQUIRE_SAME_TEAM', 'false') === 'true';
  }

  private sessionKey(callId: string) {
    return `webrtc:session:${callId}`;
  }

  private userSessionsKey(userId: string) {
    return `webrtc:user:${userId}:sessions`;
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { RtcRole, RtcTokenBuilder } from "agora-access-token";
import { v4 as uuidv4 } from "uuid";
import { ROLE_PERMISSIONS } from "../common/constants/role-permissions.constant";
import { Permission } from "../common/enums/permission.enum";
import { Role } from "../common/enums/role.enum";
import { UserStatus } from "../common/enums/user-status.enum";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { MessagingConversationType } from "../messaging/enums/messaging-conversation-type.enum";
import {
  MessagingConversation,
  MessagingConversationDocument,
} from "../messaging/schemas/conversation.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  AcceptCallDto,
  CallUserDto,
  EndCallDto,
  ListCallHistoryDto,
  MuteAllParticipantsDto,
  RegisterPushTokenDto,
  RemovePushTokenDto,
} from "./dto/calls.dto";
import { CallsEventsService } from "./calls.events.service";
import {
  ActiveCallSession,
  AgoraTokenPayload,
  CallEndReason,
  CallPartySummary,
  CallRelayUserToken,
  CallsActorContext,
  CallsSignalContext,
  CallSessionType,
  CallStatus,
} from "./calls.types";
import { CallsNotificationsService } from "./notifications.service";
import {
  CallsSession,
  CallsSessionDocument,
} from "./schemas/call-session.schema";

interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: "EX",
    seconds: number,
  ): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  srem(key: string, ...members: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<unknown>;
  quit?: () => Promise<unknown>;
  disconnect?: () => void;
}

interface CallTargetUser {
  userId: string;
  firstName: string;
  lastName: string;
  role: Role;
  teamId: string | null;
  pushTokens: string[];
}

interface ResolvedConversation {
  id: string;
  clubId: string;
  type: MessagingConversationType;
  teamId: string | null;
  participants: string[];
}

@Injectable()
export class CallsService implements OnModuleDestroy {
  private readonly logger = new Logger(CallsService.name);
  private readonly activeSessions = new Map<string, ActiveCallSession>();
  private readonly userToLocalSockets = new Map<string, Set<string>>();
  private readonly ringingTimers = new Map<string, NodeJS.Timeout>();

  private redisClient: RedisClientLike | null = null;
  private redisChecked = false;

  private readonly ringTimeoutSecondsDefault: number;
  private readonly sessionTtlSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly callsEvents: CallsEventsService,
    private readonly callsNotifications: CallsNotificationsService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(MessagingConversation.name)
    private readonly conversationModel: Model<MessagingConversationDocument>,
    @InjectModel(CallsSession.name)
    private readonly callsSessionModel: Model<CallsSessionDocument>,
  ) {
    this.ringTimeoutSecondsDefault = this.normalizeInt(
      Number(
        this.configService.get<string>("CALLS_RING_TIMEOUT_SECONDS", "30"),
      ),
      30,
      10,
      120,
    );
    this.sessionTtlSeconds = this.normalizeInt(
      Number(
        this.configService.get<string>("CALLS_SESSION_TTL_SECONDS", "43200"),
      ),
      43200,
      300,
      172800,
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

  async resolveActorFromJwtPayload(
    payload: AuthUser,
  ): Promise<CallsActorContext> {
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

  async initiateCall(actor: AuthUser | CallsActorContext, dto: CallUserDto) {
    const caller = await this.asActorContext(actor);
    this.ensureCallPermission(caller.role);

    const conversation = await this.getConversationForActor(
      caller,
      dto.conversationId,
    );

    const requestedSessionType = dto.sessionType;
    const inferredSessionType: CallSessionType =
      conversation.type === MessagingConversationType.PRIVATE
        ? "private"
        : "group";

    if (requestedSessionType && requestedSessionType !== inferredSessionType) {
      throw new BadRequestException(
        "Session type does not match the conversation type",
      );
    }

    const sessionType = requestedSessionType ?? inferredSessionType;
    const enforceSameTeam = this.isSameTeamRequired(dto.sameTeamOnly === true);

    if (sessionType === "group" && !this.canHostGroupCall(caller.role)) {
      throw new ForbiddenException(
        "Only coaches, responsables, or admins can start group calls",
      );
    }

    let invitedUserIds: string[] = [];
    let skippedBusyUserIds: string[] = [];

    if (sessionType === "private") {
      const targetUserId = this.resolvePrivateTargetUser(
        caller.userId,
        dto.targetUserId,
        conversation,
      );
      if (targetUserId === caller.userId) {
        throw new BadRequestException("Cannot call yourself");
      }

      const targetUser = await this.findUsersInClub(caller.clubId, [
        targetUserId,
      ]);
      const participant = targetUser[0];

      if (
        enforceSameTeam &&
        (!caller.teamId ||
          !participant.teamId ||
          caller.teamId !== participant.teamId)
      ) {
        throw new ForbiddenException(
          "Private calls are restricted to members of the same team",
        );
      }

      const busyUsers = await this.getBusyUserIds(caller.clubId, [
        caller.userId,
        targetUserId,
      ]);
      if (busyUsers.has(caller.userId)) {
        throw new ConflictException("You are already in another call");
      }
      if (busyUsers.has(targetUserId)) {
        throw new ConflictException("Target user is already in another call");
      }

      invitedUserIds = [targetUserId];
    } else {
      invitedUserIds = conversation.participants.filter(
        (userId) => userId !== caller.userId,
      );
      if (invitedUserIds.length === 0) {
        throw new BadRequestException(
          "Group call requires at least one invited participant",
        );
      }

      if (conversation.teamId) {
        if (!caller.teamId || caller.teamId !== conversation.teamId) {
          throw new ForbiddenException(
            "Team group calls are only allowed within your own team",
          );
        }
      }

      if (enforceSameTeam) {
        if (!caller.teamId) {
          throw new ForbiddenException(
            "Same-team group calling requires the caller to belong to a team",
          );
        }

        const allParticipants = await this.findUsersInClub(
          caller.clubId,
          invitedUserIds,
        );
        invitedUserIds = allParticipants
          .filter((participant) => participant.teamId === caller.teamId)
          .map((participant) => participant.userId);

        if (invitedUserIds.length === 0) {
          throw new ForbiddenException(
            "No same-team participants available for this group call",
          );
        }
      }

      const busyUsers = await this.getBusyUserIds(caller.clubId, [
        caller.userId,
        ...invitedUserIds,
      ]);
      if (busyUsers.has(caller.userId)) {
        throw new ConflictException("You are already in another call");
      }

      skippedBusyUserIds = invitedUserIds.filter((userId) =>
        busyUsers.has(userId),
      );
      invitedUserIds = invitedUserIds.filter(
        (userId) => !busyUsers.has(userId),
      );

      if (invitedUserIds.length === 0) {
        throw new ConflictException(
          "All invited participants are already in another call",
        );
      }
    }

    const invitedUsers = await this.findUsersInClub(
      caller.clubId,
      invitedUserIds,
    );
    const now = new Date();
    const ringTimeoutSeconds = this.normalizeInt(
      Number(dto.ringTimeoutSeconds ?? this.ringTimeoutSecondsDefault),
      this.ringTimeoutSecondsDefault,
      10,
      120,
    );

    const timeoutAt = new Date(now.getTime() + ringTimeoutSeconds * 1000);
    const channelId = this.buildChannelId(conversation, sessionType);

    const session: ActiveCallSession = {
      id: uuidv4(),
      clubId: caller.clubId,
      teamId: conversation.teamId,
      conversationId: conversation.id,
      channelId,
      sessionType,
      mediaType: dto.type,
      callerId: caller.userId,
      hostUserId: caller.userId,
      participants: [caller.userId, ...invitedUsers.map((user) => user.userId)],
      invitedUserIds: invitedUsers.map((user) => user.userId),
      acceptedUserIds: [caller.userId],
      rejectedUserIds: [],
      leftUserIds: [],
      status: "ringing",
      startedAt: now.toISOString(),
      acceptedAt: null,
      endedAt: null,
      timeoutAt: timeoutAt.toISOString(),
      endReason: null,
    };

    await this.persistActiveSession(session);

    await this.callsSessionModel.create({
      callId: session.id,
      clubId: this.toObjectId(session.clubId, "clubId"),
      teamId: session.teamId ? this.toObjectId(session.teamId, "teamId") : null,
      conversationId: this.toObjectId(session.conversationId, "conversationId"),
      channelId: session.channelId,
      sessionType: session.sessionType,
      mediaType: session.mediaType,
      status: session.status,
      callerId: this.toObjectId(session.callerId, "callerId"),
      hostUserId: this.toObjectId(session.hostUserId, "hostUserId"),
      participants: session.participants.map((userId) =>
        this.toObjectId(userId, "participantId"),
      ),
      invitedUserIds: session.invitedUserIds.map((userId) =>
        this.toObjectId(userId, "invitedUserId"),
      ),
      acceptedUserIds: session.acceptedUserIds.map((userId) =>
        this.toObjectId(userId, "acceptedUserId"),
      ),
      rejectedUserIds: [],
      leftUserIds: [],
      startedAt: now,
      timeoutAt,
      metadata: {
        skippedBusyUserIds,
        ringTimeoutSeconds,
      },
    });

    this.scheduleRingTimeout(session.id, timeoutAt);

    const callerToken = this.issueAgoraTokenForUser(
      session.channelId,
      caller.userId,
    );
    const invitedTokens: CallRelayUserToken[] = invitedUsers.map((user) => ({
      userId: user.userId,
      token: this.issueAgoraTokenForUser(session.channelId, user.userId),
    }));

    const callerName = this.getDisplayName(caller.firstName, caller.lastName);
    const pushTokens = invitedUsers.flatMap((user) => user.pushTokens ?? []);

    const pushResult = await this.callsNotifications.sendIncomingCall(
      pushTokens,
      {
        callId: session.id,
        channelId: session.channelId,
        conversationId: session.conversationId,
        callerId: caller.userId,
        callerName,
        isVideo: dto.type === "video",
        sessionType: session.sessionType,
      },
    );

    if (pushResult.invalidTokens.length > 0) {
      await this.removeInvalidPushTokens(pushResult.invalidTokens);
    }

    return {
      session,
      caller: this.toPartySummary(caller),
      invitedUsers: invitedUsers.map((user) => this.toPartySummary(user)),
      callerToken,
      invitedTokens,
      skippedBusyUserIds,
    };
  }

  async acceptCall(actor: AuthUser | CallsActorContext, dto: AcceptCallDto) {
    const participant = await this.asActorContext(actor);
    const session = await this.requireActiveSession(dto.callId);

    this.assertActorWithinSession(participant, session);

    if (session.status === "ended") {
      throw new ConflictException("Call is already ended");
    }

    const acceptedSet = new Set(session.acceptedUserIds);
    acceptedSet.add(participant.userId);

    const rejectedSet = new Set(session.rejectedUserIds);
    rejectedSet.delete(participant.userId);

    const leftSet = new Set(session.leftUserIds);
    leftSet.delete(participant.userId);

    const updated: ActiveCallSession = {
      ...session,
      acceptedUserIds: [...acceptedSet],
      rejectedUserIds: [...rejectedSet],
      leftUserIds: [...leftSet],
      status: "active",
      acceptedAt: session.acceptedAt ?? new Date().toISOString(),
    };

    this.clearRingTimeout(session.id);
    await this.persistActiveSession(updated);

    await this.callsSessionModel.updateOne(
      { callId: session.id },
      {
        $set: {
          status: "active",
          acceptedAt: new Date(updated.acceptedAt as string),
          acceptedUserIds: updated.acceptedUserIds.map((id) =>
            this.toObjectId(id, "acceptedUserId"),
          ),
          rejectedUserIds: updated.rejectedUserIds.map((id) =>
            this.toObjectId(id, "rejectedUserId"),
          ),
          leftUserIds: updated.leftUserIds.map((id) =>
            this.toObjectId(id, "leftUserId"),
          ),
        },
      },
    );

    return {
      session: updated,
      token: this.issueAgoraTokenForUser(updated.channelId, participant.userId),
    };
  }

  async rejectCall(
    actor: AuthUser | CallsActorContext,
    callId: string,
    reason?: CallEndReason,
  ) {
    const participant = await this.asActorContext(actor);
    const session = await this.requireActiveSession(callId);

    this.assertActorWithinSession(participant, session);

    if (session.status === "ended") {
      return session;
    }

    if (session.sessionType === "private") {
      return this.finishCallSession(
        session,
        reason && reason !== "timeout" ? reason : "rejected",
        participant.userId,
        {
          pushMissedToInvitees: false,
        },
      );
    }

    const rejectedSet = new Set(session.rejectedUserIds);
    rejectedSet.add(participant.userId);

    const updated: ActiveCallSession = {
      ...session,
      rejectedUserIds: [...rejectedSet],
    };

    const pendingInvitees = updated.invitedUserIds.filter(
      (userId) =>
        !updated.acceptedUserIds.includes(userId) &&
        !updated.rejectedUserIds.includes(userId) &&
        !updated.leftUserIds.includes(userId),
    );

    const acceptedInvitees = updated.acceptedUserIds.filter(
      (userId) => userId !== updated.callerId,
    );

    if (acceptedInvitees.length === 0 && pendingInvitees.length === 0) {
      return this.finishCallSession(
        updated,
        reason ?? "rejected",
        participant.userId,
        {
          pushMissedToInvitees: false,
        },
      );
    }

    await this.persistActiveSession(updated);
    await this.callsSessionModel.updateOne(
      { callId: session.id },
      {
        $set: {
          rejectedUserIds: updated.rejectedUserIds.map((id) =>
            this.toObjectId(id, "rejectedUserId"),
          ),
        },
      },
    );

    return updated;
  }

  async endCall(actor: AuthUser | CallsActorContext, dto: EndCallDto) {
    const participant = await this.asActorContext(actor);
    const session = await this.requireActiveSession(dto.callId);

    this.assertActorWithinSession(participant, session);

    if (session.status === "ended") {
      return {
        endedForAll: true,
        session,
      };
    }

    if (session.sessionType === "private") {
      const reason =
        dto.reason ??
        (session.status === "ringing" ? "cancelled" : "completed");
      const endedSession = await this.finishCallSession(
        session,
        reason,
        participant.userId,
        {
          pushMissedToInvitees: session.status === "ringing",
        },
      );
      return {
        endedForAll: true,
        session: endedSession,
      };
    }

    if (dto.terminateForAll === true) {
      const endedSession = await this.finishCallSession(
        session,
        dto.reason ??
          (session.status === "ringing" ? "cancelled" : "completed"),
        participant.userId,
        {
          pushMissedToInvitees: session.status === "ringing",
        },
      );
      return {
        endedForAll: true,
        session: endedSession,
      };
    }

    const leftSet = new Set(session.leftUserIds);
    leftSet.add(participant.userId);

    const updated: ActiveCallSession = {
      ...session,
      leftUserIds: [...leftSet],
    };

    const activeJoinedParticipants = updated.acceptedUserIds.filter(
      (userId) => !updated.leftUserIds.includes(userId),
    );

    if (activeJoinedParticipants.length === 0) {
      const endedSession = await this.finishCallSession(
        updated,
        dto.reason ?? "completed",
        participant.userId,
        {
          pushMissedToInvitees: false,
        },
      );
      return {
        endedForAll: true,
        session: endedSession,
      };
    }

    await this.persistActiveSession(updated);
    await this.callsSessionModel.updateOne(
      { callId: updated.id },
      {
        $set: {
          leftUserIds: updated.leftUserIds.map((id) =>
            this.toObjectId(id, "leftUserId"),
          ),
        },
      },
    );

    return {
      endedForAll: false,
      session: updated,
      changedUserId: participant.userId,
    };
  }

  async endCallsForDisconnectedUser(userId: string) {
    const callIds = await this.getActiveCallIdsForUser(userId);
    const ended: ActiveCallSession[] = [];
    const presenceUpdates: Array<{
      callId: string;
      conversationId: string;
      changedUserId: string;
    }> = [];

    for (const callId of callIds) {
      const session = await this.getActiveSession(callId);
      if (!session || session.status === "ended") {
        continue;
      }

      if (!session.participants.includes(userId)) {
        continue;
      }

      if (session.sessionType === "private") {
        ended.push(
          await this.finishCallSession(session, "disconnected", userId, {
            pushMissedToInvitees: false,
          }),
        );
        continue;
      }

      const leftSet = new Set(session.leftUserIds);
      leftSet.add(userId);

      const updated: ActiveCallSession = {
        ...session,
        leftUserIds: [...leftSet],
      };

      const activeJoinedParticipants = updated.acceptedUserIds.filter(
        (participantId) => !updated.leftUserIds.includes(participantId),
      );

      if (activeJoinedParticipants.length === 0) {
        ended.push(
          await this.finishCallSession(updated, "disconnected", userId, {
            pushMissedToInvitees: false,
          }),
        );
      } else {
        await this.persistActiveSession(updated);
        await this.callsSessionModel.updateOne(
          { callId: updated.id },
          {
            $set: {
              leftUserIds: updated.leftUserIds.map((id) =>
                this.toObjectId(id, "leftUserId"),
              ),
            },
          },
        );

        presenceUpdates.push({
          callId: updated.id,
          conversationId: updated.conversationId,
          changedUserId: userId,
        });
      }
    }

    return {
      ended,
      presenceUpdates,
    };
  }

  async issueAgoraToken(actor: AuthUser | CallsActorContext, callId: string) {
    const participant = await this.asActorContext(actor);
    const session = await this.requireActiveSession(callId);

    this.assertActorWithinSession(participant, session);

    if (session.status === "ended") {
      throw new ConflictException("Cannot issue token for an ended call");
    }

    return {
      session,
      token: this.issueAgoraTokenForUser(session.channelId, participant.userId),
    };
  }

  async relayOffer(
    actor: AuthUser | CallsActorContext,
    callId: string,
  ): Promise<CallsSignalContext> {
    return this.relaySignal(actor, callId);
  }

  async relayAnswer(
    actor: AuthUser | CallsActorContext,
    callId: string,
  ): Promise<CallsSignalContext> {
    return this.relaySignal(actor, callId);
  }

  async relayIceCandidate(
    actor: AuthUser | CallsActorContext,
    callId: string,
  ): Promise<CallsSignalContext> {
    return this.relaySignal(actor, callId);
  }

  async muteAllParticipants(
    actor: AuthUser | CallsActorContext,
    dto: MuteAllParticipantsDto,
  ) {
    const participant = await this.asActorContext(actor);
    const session = await this.requireActiveSession(dto.callId);

    this.assertActorWithinSession(participant, session);

    if (session.sessionType !== "group") {
      throw new BadRequestException(
        "Mute-all is only available in group calls",
      );
    }

    if (!this.canControlGroupCall(participant, session)) {
      throw new ForbiddenException(
        "Only the call host can mute all participants",
      );
    }

    const metadataRow = await this.callsSessionModel
      .findOne({ callId: session.id })
      .select("metadata")
      .lean();

    const muted = dto.muted ?? true;
    const nextMetadata = {
      ...(metadataRow?.metadata ?? {}),
      muteAll: muted,
      muteAllUpdatedBy: participant.userId,
      muteAllUpdatedAt: new Date().toISOString(),
    };

    await this.callsSessionModel.updateOne(
      { callId: session.id },
      {
        $set: {
          metadata: nextMetadata,
        },
      },
    );

    return {
      session,
      muted,
    };
  }

  async getCallSessionForActor(
    actor: AuthUser | CallsActorContext,
    callId: string,
  ) {
    const participant = await this.asActorContext(actor);
    const session = await this.requireActiveSession(callId);

    this.assertActorWithinSession(participant, session);
    return session;
  }

  async registerPushToken(actor: AuthUser, dto: RegisterPushTokenDto) {
    const actorContext = await this.resolveActorContext(actor);
    const normalized = dto.token.trim();

    await this.userModel.updateOne(
      {
        _id: this.toObjectId(actorContext.userId, "userId"),
        clubId: this.toObjectId(actorContext.clubId, "clubId"),
      },
      {
        $addToSet: { pushTokens: normalized },
      },
    );

    return { success: true };
  }

  async removePushToken(actor: AuthUser, dto: RemovePushTokenDto) {
    const actorContext = await this.resolveActorContext(actor);
    const normalized = dto.token.trim();

    await this.userModel.updateOne(
      {
        _id: this.toObjectId(actorContext.userId, "userId"),
        clubId: this.toObjectId(actorContext.clubId, "clubId"),
      },
      {
        $pull: { pushTokens: normalized },
      },
    );

    return { success: true };
  }

  async listCallHistory(actor: AuthUser, query: ListCallHistoryDto) {
    const actorContext = await this.resolveActorContext(actor);
    const limit = Math.min(Math.max(Number(query.limit ?? 30), 1), 200);

    const filters: Record<string, unknown> = {
      clubId: this.toObjectId(actorContext.clubId, "clubId"),
      participants: this.toObjectId(actorContext.userId, "userId"),
    };

    if (query.sessionType) {
      filters.sessionType = query.sessionType;
    }
    if (query.mediaType) {
      filters.mediaType = query.mediaType;
    }

    const rows = await this.callsSessionModel
      .find(filters)
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();

    const userIds = new Set<string>();
    for (const row of rows) {
      userIds.add(String(row.callerId));
      for (const participantId of row.participants ?? []) {
        userIds.add(String(participantId));
      }
    }

    const users = userIds.size
      ? await this.userModel
          .find({
            _id: {
              $in: Array.from(userIds).map((id) =>
                this.toObjectId(id, "userId"),
              ),
            },
            clubId: this.toObjectId(actorContext.clubId, "clubId"),
          })
          .select("_id firstName lastName role teamId")
          .lean()
      : [];

    const userMap = new Map<
      string,
      { firstName: string; lastName: string; role: Role; teamId: string | null }
    >();
    for (const user of users) {
      userMap.set(String(user._id), {
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        teamId: user.teamId ? String(user.teamId) : null,
      });
    }

    return rows.map((row) => ({
      callId: row.callId,
      clubId: String(row.clubId),
      teamId: row.teamId ? String(row.teamId) : null,
      conversationId: String(row.conversationId),
      channelId: row.channelId,
      sessionType: row.sessionType,
      mediaType: row.mediaType,
      status: row.status,
      callerId: String(row.callerId),
      caller: userMap.get(String(row.callerId)) ?? null,
      participants: (row.participants ?? []).map((participantId) => {
        const normalizedId = String(participantId);
        const user = userMap.get(normalizedId);
        return {
          userId: normalizedId,
          firstName: user?.firstName ?? "",
          lastName: user?.lastName ?? "",
          role: user?.role ?? null,
          teamId: user?.teamId ?? null,
        };
      }),
      invitedUserIds: (row.invitedUserIds ?? []).map((id) => String(id)),
      acceptedUserIds: (row.acceptedUserIds ?? []).map((id) => String(id)),
      rejectedUserIds: (row.rejectedUserIds ?? []).map((id) => String(id)),
      leftUserIds: (row.leftUserIds ?? []).map((id) => String(id)),
      startedAt: row.startedAt,
      acceptedAt: row.acceptedAt ?? null,
      endedAt: row.endedAt ?? null,
      timeoutAt: row.timeoutAt ?? null,
      endReason: row.endReason ?? null,
      metadata: row.metadata ?? {},
    }));
  }

  private resolvePrivateTargetUser(
    callerUserId: string,
    targetUserId: string | undefined,
    conversation: ResolvedConversation,
  ) {
    if (conversation.type !== MessagingConversationType.PRIVATE) {
      throw new BadRequestException(
        "Private calls require a private conversation",
      );
    }

    const peers = conversation.participants.filter((id) => id !== callerUserId);
    if (peers.length !== 1) {
      throw new BadRequestException(
        "Private conversation must contain exactly two participants",
      );
    }

    const resolvedTarget = targetUserId ?? peers[0];
    if (!conversation.participants.includes(resolvedTarget)) {
      throw new ForbiddenException(
        "Target user is not part of this conversation",
      );
    }

    return resolvedTarget;
  }

  private async finishCallSession(
    session: ActiveCallSession,
    reason: CallEndReason,
    endedByUserId: string | null,
    options: { pushMissedToInvitees: boolean },
  ) {
    if (session.status === "ended") {
      return session;
    }

    const endedAt = new Date().toISOString();
    const updated: ActiveCallSession = {
      ...session,
      status: "ended",
      endedAt,
      endReason: reason,
    };

    this.clearRingTimeout(session.id);

    await this.callsSessionModel.updateOne(
      { callId: session.id },
      {
        $set: {
          status: "ended",
          endedAt: new Date(endedAt),
          endReason: reason,
          acceptedUserIds: updated.acceptedUserIds.map((id) =>
            this.toObjectId(id, "acceptedUserId"),
          ),
          rejectedUserIds: updated.rejectedUserIds.map((id) =>
            this.toObjectId(id, "rejectedUserId"),
          ),
          leftUserIds: updated.leftUserIds.map((id) =>
            this.toObjectId(id, "leftUserId"),
          ),
          metadata: {
            endedByUserId,
          },
        },
      },
    );

    await this.removeActiveSession(updated);

    if (options.pushMissedToInvitees) {
      await this.pushMissedCallIfNeeded(updated);
    }

    return updated;
  }

  private async relaySignal(
    actor: AuthUser | CallsActorContext,
    callId: string,
  ): Promise<CallsSignalContext> {
    const participant = await this.asActorContext(actor);
    const session = await this.requireActiveSession(callId);

    this.assertActorWithinSession(participant, session);

    if (session.status === "ended") {
      throw new ConflictException("Call has already ended");
    }

    const toUserIds = session.participants.filter(
      (userId) =>
        userId !== participant.userId &&
        !session.rejectedUserIds.includes(userId) &&
        !session.leftUserIds.includes(userId),
    );

    return {
      session,
      fromUserId: participant.userId,
      toUserIds,
    };
  }

  private async pushMissedCallIfNeeded(session: ActiveCallSession) {
    const unansweredInvitees = session.invitedUserIds.filter(
      (userId) =>
        !session.acceptedUserIds.includes(userId) &&
        !session.rejectedUserIds.includes(userId) &&
        !session.leftUserIds.includes(userId),
    );

    if (unansweredInvitees.length === 0) {
      return;
    }

    const [caller] = await this.findUsersInClub(session.clubId, [
      session.callerId,
    ]);
    const missedUsers = await this.findUsersInClub(
      session.clubId,
      unansweredInvitees,
    );
    const tokens = missedUsers.flatMap((user) => user.pushTokens ?? []);

    if (tokens.length === 0) {
      return;
    }

    const result = await this.callsNotifications.sendMissedCall(tokens, {
      callId: session.id,
      callerName: this.getDisplayName(caller.firstName, caller.lastName),
      conversationId: session.conversationId,
    });

    if (result.invalidTokens.length > 0) {
      await this.removeInvalidPushTokens(result.invalidTokens);
    }
  }

  private async persistActiveSession(session: ActiveCallSession) {
    this.activeSessions.set(session.id, session);

    const redis = await this.getRedisClient();
    if (!redis) {
      return;
    }

    await redis.set(
      this.sessionKey(session.id),
      JSON.stringify(session),
      "EX",
      this.sessionTtlSeconds,
    );

    for (const userId of session.participants) {
      await redis.sadd(this.userSessionsKey(userId), session.id);
      await redis.expire(this.userSessionsKey(userId), this.sessionTtlSeconds);
    }
  }

  private async removeActiveSession(session: ActiveCallSession) {
    this.activeSessions.delete(session.id);

    const redis = await this.getRedisClient();
    if (!redis) {
      return;
    }

    await redis.del(this.sessionKey(session.id));

    for (const userId of session.participants) {
      await redis.srem(this.userSessionsKey(userId), session.id);
    }
  }

  private async getActiveSession(
    callId: string,
  ): Promise<ActiveCallSession | null> {
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

      this.activeSessions.set(parsed.id, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  private async getActiveCallIdsForUser(userId: string) {
    const callIds = new Set<string>();

    for (const [callId, session] of this.activeSessions.entries()) {
      if (session.participants.includes(userId)) {
        callIds.add(callId);
      }
    }

    const redis = await this.getRedisClient();
    if (redis) {
      const redisCallIds = await redis.smembers(this.userSessionsKey(userId));
      for (const callId of redisCallIds) {
        callIds.add(callId);
      }
    }

    return [...callIds];
  }

  private async requireActiveSession(callId: string) {
    const session = await this.getActiveSession(callId);
    if (!session) {
      throw new NotFoundException("Call session not found or already ended");
    }
    return session;
  }

  private assertActorWithinSession(
    actor: CallsActorContext,
    session: ActiveCallSession,
  ) {
    if (actor.clubId !== session.clubId) {
      throw new ForbiddenException("Cross-club call access is not allowed");
    }

    if (!session.participants.includes(actor.userId)) {
      throw new ForbiddenException("You are not part of this call");
    }
  }

  private async getBusyUserIds(clubId: string, userIds: string[]) {
    const uniqueUserIds = Array.from(new Set(userIds));
    if (uniqueUserIds.length === 0) {
      return new Set<string>();
    }

    const busyRows = await this.callsSessionModel
      .find({
        clubId: this.toObjectId(clubId, "clubId"),
        status: { $in: ["ringing", "active"] as CallStatus[] },
        endedAt: null,
        participants: {
          $in: uniqueUserIds.map((userId) => this.toObjectId(userId, "userId")),
        },
      })
      .select("participants")
      .lean();

    const busy = new Set<string>();
    for (const row of busyRows) {
      for (const participantId of row.participants ?? []) {
        const normalized = String(participantId);
        if (uniqueUserIds.includes(normalized)) {
          busy.add(normalized);
        }
      }
    }

    return busy;
  }

  private scheduleRingTimeout(callId: string, timeoutAt: Date) {
    this.clearRingTimeout(callId);

    const delay = Math.max(timeoutAt.getTime() - Date.now(), 1000);
    const timer = setTimeout(() => {
      void this.timeoutRingingCall(callId);
    }, delay);

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
      if (!session || session.status !== "ringing") {
        return;
      }

      const ended = await this.finishCallSession(session, "timeout", null, {
        pushMissedToInvitees: true,
      });

      this.callsEvents.emitToUsers(ended.participants, "call_ended", {
        callId: ended.id,
        conversationId: ended.conversationId,
        channelId: ended.channelId,
        reason: "timeout",
        endedBy: null,
        endedAt: ended.endedAt,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to timeout call ${callId} (${error instanceof Error ? error.message : "unknown error"})`,
      );
    }
  }

  private issueAgoraTokenForUser(
    channelId: string,
    userId: string,
  ): AgoraTokenPayload {
    const appId = this.configService.get<string>("AGORA_APP_ID");
    const appCertificate = this.configService.get<string>(
      "AGORA_APP_CERTIFICATE",
    );

    if (!appId || !appCertificate) {
      throw new ConflictException(
        "Agora credentials are not configured on the server",
      );
    }

    const expiresAtUnix = Math.floor(Date.now() / 1000) + 3600;
    const uid = this.toAgoraUid(userId);

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelId,
      uid,
      RtcRole.PUBLISHER,
      expiresAtUnix,
    );

    return {
      appId,
      channelId,
      token,
      uid,
      expiresAt: new Date(expiresAtUnix * 1000).toISOString(),
    };
  }

  private buildChannelId(
    conversation: ResolvedConversation,
    sessionType: CallSessionType,
  ) {
    if (sessionType === "private") {
      return `conv_${conversation.id}`;
    }

    if (conversation.teamId) {
      return `team_${conversation.teamId}`;
    }

    return `group_${conversation.id}`;
  }

  private toAgoraUid(userId: string) {
    const normalized = userId.replace(/[^a-fA-F0-9]/g, "");
    const tail = normalized.slice(-8);
    const parsed = Number.parseInt(tail, 16);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1;
    }

    return parsed;
  }

  private async resolveActorContext(
    actor: AuthUser,
  ): Promise<CallsActorContext> {
    if (!actor.clubId) {
      throw new ForbiddenException("Club-scoped access is required for calls");
    }

    const user = await this.userModel
      .findOne({
        _id: this.toObjectId(actor.sub, "actor user id"),
        clubId: this.toObjectId(actor.clubId, "actor club id"),
        status: UserStatus.ACTIVE,
      })
      .select("_id email role clubId teamId firstName lastName pushTokens")
      .lean();

    if (!user) {
      throw new ForbiddenException("Active user not found in your club scope");
    }

    return {
      userId: String(user._id),
      email: user.email,
      role: user.role,
      clubId: String(user.clubId),
      teamId: user.teamId ? String(user.teamId) : null,
      firstName: user.firstName,
      lastName: user.lastName,
      pushTokens: Array.isArray((user as any).pushTokens)
        ? ((user as any).pushTokens as string[])
        : [],
    };
  }

  private async asActorContext(actor: AuthUser | CallsActorContext) {
    const parsed = actor as CallsActorContext;
    if (parsed.userId && parsed.clubId) {
      return parsed;
    }

    return this.resolveActorContext(actor as AuthUser);
  }

  private ensureCallPermission(role: Role) {
    const permissions = ROLE_PERMISSIONS[role] ?? [];
    if (!permissions.includes(Permission.CHAT_WRITE)) {
      throw new ForbiddenException("Your role is not allowed to place calls");
    }
  }

  private canHostGroupCall(role: Role) {
    return [Role.ADMIN, Role.CLUB_RESPONSABLE, Role.STAFF_TECHNIQUE].includes(
      role,
    );
  }

  private canControlGroupCall(
    actor: CallsActorContext,
    session: ActiveCallSession,
  ) {
    if (actor.userId === session.hostUserId) {
      return true;
    }

    return this.canHostGroupCall(actor.role);
  }

  private async getConversationForActor(
    actor: CallsActorContext,
    conversationId: string,
  ): Promise<ResolvedConversation> {
    const conversation = await this.conversationModel
      .findOne({
        _id: this.toObjectId(conversationId, "conversationId"),
        clubId: this.toObjectId(actor.clubId, "clubId"),
        participants: this.toObjectId(actor.userId, "actor user id"),
      })
      .select("_id clubId teamId participants type")
      .lean();

    if (!conversation) {
      throw new ForbiddenException(
        "Conversation is outside your club scope or you are not a participant",
      );
    }

    const teamId = conversation.teamId ? String(conversation.teamId) : null;
    if (conversation.type === MessagingConversationType.GROUP && teamId) {
      if (!actor.teamId || actor.teamId !== teamId) {
        throw new ForbiddenException(
          "Team conversations are restricted to members of the same team",
        );
      }
    }

    return {
      id: String(conversation._id),
      clubId: String(conversation.clubId),
      type: conversation.type,
      teamId,
      participants: (conversation.participants ?? []).map((id) => String(id)),
    };
  }

  private async findUsersInClub(
    clubId: string,
    userIds: string[],
  ): Promise<CallTargetUser[]> {
    const uniqueIds = Array.from(new Set(userIds));
    if (uniqueIds.length === 0) {
      return [];
    }

    const users = await this.userModel
      .find({
        _id: { $in: uniqueIds.map((id) => this.toObjectId(id, "userId")) },
        clubId: this.toObjectId(clubId, "clubId"),
        status: UserStatus.ACTIVE,
      })
      .select("_id firstName lastName role teamId pushTokens")
      .lean();

    if (users.length !== uniqueIds.length) {
      throw new ForbiddenException(
        "Some participants are outside your club scope or inactive",
      );
    }

    return users.map((user) => ({
      userId: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      teamId: user.teamId ? String(user.teamId) : null,
      pushTokens: Array.isArray((user as any).pushTokens)
        ? ((user as any).pushTokens as string[])
        : [],
    }));
  }

  private toPartySummary(user: {
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
      teamId: user.teamId,
    };
  }

  private getDisplayName(firstName: string, lastName: string) {
    return `${firstName} ${lastName}`.trim();
  }

  private async removeInvalidPushTokens(tokens: string[]) {
    const uniqueTokens = Array.from(new Set(tokens));
    if (uniqueTokens.length === 0) {
      return;
    }

    await this.userModel.updateMany(
      { pushTokens: { $in: uniqueTokens } },
      { $pull: { pushTokens: { $in: uniqueTokens } } },
    );
  }

  private async getRedisClient(): Promise<RedisClientLike | null> {
    if (this.redisChecked) {
      return this.redisClient;
    }

    this.redisChecked = true;

    const redisUrl = this.configService.get<string>("REDIS_URL");
    const redisHost = this.configService.get<string>("REDIS_HOST");
    const redisPort = Number(
      this.configService.get<string>("REDIS_PORT", "6379"),
    );

    if (!redisUrl && !redisHost) {
      this.logger.log(
        "Redis session store disabled for calls module (no REDIS_URL/REDIS_HOST)",
      );
      return null;
    }

    try {
      // Dynamic loading allows the backend to start without Redis.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require("ioredis");
      this.redisClient = redisUrl
        ? new Redis(redisUrl)
        : new Redis({
            host: redisHost,
            port: Number.isFinite(redisPort) ? redisPort : 6379,
          });
      return this.redisClient;
    } catch (error) {
      this.logger.warn(
        `Calls Redis session store unavailable (${error instanceof Error ? error.message : "unknown error"})`,
      );
      this.redisClient = null;
      return null;
    }
  }

  private isSameTeamRequired(requestedSameTeamOnly: boolean) {
    if (requestedSameTeamOnly) {
      return true;
    }

    return (
      this.configService.get<string>("CALLS_REQUIRE_SAME_TEAM", "false") ===
      "true"
    );
  }

  private normalizeInt(
    value: number,
    fallback: number,
    min: number,
    max: number,
  ) {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(Math.max(Math.round(value), min), max);
  }

  private toObjectId(raw: string, field: string) {
    if (!Types.ObjectId.isValid(raw)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return new Types.ObjectId(raw);
  }

  private sessionKey(callId: string) {
    return `calls:session:${callId}`;
  }

  private userSessionsKey(userId: string) {
    return `calls:user:${userId}:sessions`;
  }
}

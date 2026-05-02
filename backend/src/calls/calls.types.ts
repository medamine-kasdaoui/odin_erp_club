import { Role } from "../common/enums/role.enum";

export const CALL_MEDIA_TYPES = ["audio", "video"] as const;
export type CallMediaType = (typeof CALL_MEDIA_TYPES)[number];

export const CALL_SESSION_TYPES = ["private", "group"] as const;
export type CallSessionType = (typeof CALL_SESSION_TYPES)[number];

export const CALL_STATUSES = ["ringing", "active", "ended"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_END_REASONS = [
  "rejected",
  "cancelled",
  "completed",
  "timeout",
  "disconnected",
  "missed",
  "failed",
  "left",
] as const;
export type CallEndReason = (typeof CALL_END_REASONS)[number];

export interface CallsActorContext {
  userId: string;
  email: string;
  role: Role;
  clubId: string;
  teamId: string | null;
  firstName: string;
  lastName: string;
  pushTokens: string[];
}

export interface CallPartySummary {
  userId: string;
  firstName: string;
  lastName: string;
  role: Role;
  teamId: string | null;
}

export interface ActiveCallSession {
  id: string;
  clubId: string;
  teamId: string | null;
  conversationId: string;
  channelId: string;
  sessionType: CallSessionType;
  mediaType: CallMediaType;
  callerId: string;
  hostUserId: string;
  participants: string[];
  invitedUserIds: string[];
  acceptedUserIds: string[];
  rejectedUserIds: string[];
  leftUserIds: string[];
  status: CallStatus;
  startedAt: string;
  acceptedAt?: string | null;
  endedAt?: string | null;
  timeoutAt?: string | null;
  endReason?: CallEndReason | null;
}

export interface AgoraTokenPayload {
  appId: string;
  channelId: string;
  token: string;
  uid: number;
  expiresAt: string;
}

export interface IncomingCallPushPayload {
  callId: string;
  channelId: string;
  conversationId: string;
  callerId: string;
  callerName: string;
  isVideo: boolean;
  sessionType: CallSessionType;
}

export interface CallRelayUserToken {
  userId: string;
  token: AgoraTokenPayload;
}

export interface CallsSignalContext {
  session: ActiveCallSession;
  fromUserId: string;
  toUserIds: string[];
}

export interface GroupCallPresenceUpdate {
  session: ActiveCallSession;
  changedUserId: string;
  action: "accepted" | "rejected" | "left";
}

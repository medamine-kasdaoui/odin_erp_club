import { Role } from '../common/enums/role.enum';

export const WEBRTC_CALL_TYPES = ['audio', 'video'] as const;
export type WebrtcCallType = (typeof WEBRTC_CALL_TYPES)[number];

export const WEBRTC_CALL_STATUSES = ['ringing', 'active', 'ended'] as const;
export type WebrtcCallStatus = (typeof WEBRTC_CALL_STATUSES)[number];

export const WEBRTC_END_REASONS = [
  'rejected',
  'cancelled',
  'completed',
  'timeout',
  'disconnected',
  'failed'
] as const;
export type WebrtcEndReason = (typeof WEBRTC_END_REASONS)[number];

export interface WebrtcActorContext {
  userId: string;
  email: string;
  role: Role;
  clubId: string;
  teamId: string | null;
  firstName: string;
  lastName: string;
}

export interface ActiveCallSession {
  id: string;
  clubId: string;
  conversationId: string;
  callerId: string;
  receiverId: string;
  type: WebrtcCallType;
  status: WebrtcCallStatus;
  startedAt: string;
  acceptedAt?: string | null;
  endedAt?: string | null;
  endReason?: WebrtcEndReason | null;
}

export interface CallPartySummary {
  userId: string;
  firstName: string;
  lastName: string;
  role: Role;
  teamId: string | null;
}

export interface SignalingRelayTarget {
  session: ActiveCallSession;
  fromUserId: string;
  toUserId: string;
}

# ODIN WebRTC Signaling Module

Namespace: `webrtc`

## Client -> Server events

- `call_user`: `{ conversationId, targetUserId, type: "audio" | "video", sameTeamOnly? }`
- `accept_call`: `{ callId }`
- `reject_call`: `{ callId, reason? }`
- `end_call`: `{ callId, reason? }`
- `webrtc_offer`: `{ callId, sdp }`
- `webrtc_answer`: `{ callId, sdp }`
- `ice_candidate`: `{ callId, candidate }`

## Server -> Client events

- `incoming_call`
- `call_accepted`
- `call_rejected`
- `call_ended`
- `webrtc_offer`
- `webrtc_answer`
- `ice_candidate`

## Security checks

- JWT authentication on socket connect
- Caller and receiver must belong to the same club
- Caller and receiver must both be participants in the conversation
- Optional same-team enforcement via:
  - `WEBRTC_REQUIRE_SAME_TEAM=true`
  - or `sameTeamOnly: true` in `call_user`

## Redis scaling

- Socket.IO Redis adapter enabled when `REDIS_URL` or `REDIS_HOST` is configured
- Active call sessions stored in Redis with TTL
- Session keys:
  - `webrtc:session:<callId>`
  - `webrtc:user:<userId>:sessions`

## Timeouts

- Ring timeout: `WEBRTC_RING_TIMEOUT_MS` (default: 30000)
- Session TTL: `WEBRTC_SESSION_TTL_SECONDS` (default: 43200)

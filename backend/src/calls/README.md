# Calls Module (Agora + WebSocket + FCM)

This module powers real-time calls for ODIN ERP CLUB.

## Namespace

- WebSocket namespace: `webrtc` (kept for client compatibility)

## Socket Events

### Client -> Server

- `call_user`
- `accept_call`
- `reject_call`
- `end_call`
- `mute_all_participants` (group call host only)

### Server -> Client

- `incoming_call`
- `call_accepted`
- `call_rejected`
- `call_ended`
- `conversation_updated` (`type: "call_presence"` for group join/leave/reject updates)

## REST API

- `POST /api/calls/push-token`
- `POST /api/calls/push-token/remove`
- `POST /api/calls/token`
- `GET /api/calls/:callId`
- `GET /api/calls/history`

## Security Rules

- Caller must be authenticated and active.
- Calls are restricted to same club members.
- Team group conversations (`conversation.teamId != null`) are restricted to the same team.
- Optional strict same-team mode:
  - `CALLS_REQUIRE_SAME_TEAM=true`
  - or per call payload `sameTeamOnly: true`

## Agora Token

- Generated with `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE`
- Expires in 1 hour.
- Channel naming:
  - private: `conv_<conversationId>`
  - team group: `team_<teamId>`
  - club group: `group_<conversationId>`

## Push Notifications

Incoming calls and missed calls are sent via Firebase Admin SDK.

Required env vars:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- or `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`

## Flutter Integration Outline

1. Register FCM token after login:

```http
POST /api/calls/push-token
{ "token": "<fcm-token>", "platform": "android" }
```

2. Connect socket with JWT to namespace `webrtc`.

3. Start call:

```json
{
  "event": "call_user",
  "data": {
    "conversationId": "...",
    "type": "audio"
  }
}
```

4. On `incoming_call`, show incoming UI.

5. On accept:

- emit `accept_call` with `callId`
- join Agora with token from event response OR from `POST /api/calls/token`

6. Use FCM background handler to open incoming call screen when app is killed/backgrounded.

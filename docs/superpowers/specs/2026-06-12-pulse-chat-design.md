# pulse-chat — Design Document

- **Date:** 2026-06-12
- **Status:** Draft / pending implementation plan
- **Project root:** `~/dev/pulse-chat`

## Goal

Build a pet-project corporate mobile messenger with a built-in VPN. The first public-facing deliverable is a working prototype that can authenticate users, maintain a contact list, and exchange real-time text messages. Audio calls and the native WireGuard VPN client follow in subsequent phases.

## Scope by Phase

| Phase | Focus | In scope | Out of scope |
|-------|-------|----------|--------------|
| **Phase 1 — Core messenger** | Foundation | Registration/login, contacts, 1-to-1 and group chats, real-time message delivery/read receipts, i18n (ru/en), Docker-based backend | Audio/video calls, native VPN |
| **Phase 2 — Audio calls** | Voice | 1-to-1 audio calls via WebRTC, signaling over Socket.io, call history messages | Group calls, video calls |
| **Phase 3 — Built-in VPN** | Security | Native WireGuard tunnel for iOS/Android, config delivery from backend, in-app VPN toggle | VLESS/Xray native client, traffic split-routing |

This document focuses on **Phase 1**; later phases are described at a high level only.

## Non-goals

- Self-hosted/on-prem deployment automation beyond local Docker Compose.
- E2E encryption in Phase 1 (transport TLS only).
- Push notifications in Phase 1 (background state is not handled).
- Desktop or web clients in Phase 1.
- Admin dashboard.

## Context

- Existing `~/dev/ru-vpn-hub` provides a VLESS/Xray-based VPN portal. For the native in-app VPN we will add a **WireGuard** server to the same host/infrastructure and reuse the user identity model from the messenger backend.
- The primary stack follows the workspace convention: TypeScript/React for the client and Node.js for the backend.

## Architecture

```
┌─────────────────────────────────────┐
│  Expo / React Native (iOS + Android)│
│  TypeScript, React Navigation,      │
│  i18next, Zustand, TanStack Query   │
└──────────────┬──────────────────────┘
               │ HTTPS + WebSocket
               ▼
┌─────────────────────────────────────┐
│  Node.js API                        │
│  Express, Socket.io, JWT auth       │
└──────────────┬──────────────────────┘
               │ SQL
               ▼
┌─────────────────────────────────────┐
│  PostgreSQL                         │
│  Users, contacts, chats, messages   │
└─────────────────────────────────────┘
```

### Backend services (Docker Compose)

| Service | Image / runtime | Purpose |
|---------|-----------------|---------|
| `postgres` | `postgres:16-alpine` | Primary data store |
| `redis` | `redis:7-alpine` | Socket.io adapter + online presence (optional for Phase 1) |
| `api` | Node.js 22 | REST API + Socket.io server |

### Client navigation

- `AuthStack`
  - `WelcomeScreen`
  - `LoginScreen`
  - `RegisterScreen`
- `MainTabs`
  - `ChatsTab`
  - `ContactsTab`
  - `ProfileTab`
- `ChatStack`
  - `ChatScreen`

## Data Model

PostgreSQL schema managed by Prisma ORM.

```prisma
model User {
  id                 String   @id @default(uuid())
  email              String   @unique
  passwordHash       String
  displayName        String
  avatarUrl          String?
  preferredLanguage  String   @default("ru")
  createdAt          DateTime @default(now())
  lastSeenAt         DateTime @default(now())

  ownedContacts      Contact[] @relation("ContactOwner")
  targetOfContacts   Contact[] @relation("ContactTarget")
  memberships        ChatMember[]
  messages           Message[]
  readReceipts       ReadReceipt[]
}

model Contact {
  id        String           @id @default(uuid())
  ownerId   String
  targetId  String
  status    ContactStatus    @default(pending)
  createdAt DateTime         @default(now())

  owner     User @relation("ContactOwner", fields: [ownerId], references: [id])
  target    User @relation("ContactTarget", fields: [targetId], references: [id])

  @@unique([ownerId, targetId])
}

enum ContactStatus {
  pending
  accepted
  blocked
}

model Chat {
  id        String    @id @default(uuid())
  type      ChatType
  title     String?
  avatarUrl String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  members   ChatMember[]
  messages  Message[]
}

enum ChatType {
  direct
  group
}

model ChatMember {
  id       String    @id @default(uuid())
  chatId   String
  userId   String
  role     MemberRole @default(member)
  joinedAt DateTime   @default(now())

  chat Chat @relation(fields: [chatId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([chatId, userId])
}

enum MemberRole {
  member
  admin
  owner
}

model Message {
  id        String       @id @default(uuid())
  chatId    String
  authorId  String
  type      MessageType  @default(text)
  content   String
  createdAt DateTime     @default(now())
  editedAt  DateTime?

  chat          Chat          @relation(fields: [chatId], references: [id], onDelete: Cascade)
  author        User          @relation(fields: [authorId], references: [id])
  readReceipts  ReadReceipt[]
}

enum MessageType {
  text
  audio
  call
}

model ReadReceipt {
  id        String   @id @default(uuid())
  messageId String
  userId    String
  readAt    DateTime @default(now())

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId])
}
```

### Notes

- `Chat` of type `direct` is created automatically when a contact request is accepted, but only once per pair of users. Subsequent accepts return the existing direct chat.
- `Chat` of type `group` is created by a user and must include at least one other member in the creation request.
- `Message.type` values `audio` and `call` are reserved for Phase 2 and Phase 3 UI but are stored as enums from Phase 1 to avoid future migrations.
- A user cannot send a read receipt for their own message; the server ignores such requests.

## REST API (Phase 1)

All endpoints return JSON and require an `Authorization: Bearer <jwt>` header except auth endpoints.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account (email, password, displayName) |
| POST | `/api/auth/login` | Exchange credentials for JWT |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Invalidate refresh token |

### Users / contacts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/me` | Current user profile |
| PATCH | `/api/users/me` | Update profile, including `preferredLanguage` |
| GET | `/api/users/search?q=` | Search users by email/displayName |
| GET | `/api/contacts` | List my contacts |
| POST | `/api/contacts` | Send contact request |
| PATCH | `/api/contacts/:id` | Accept / block / remove |

### Chats / messages

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chats` | List chats with last message preview |
| POST | `/api/chats` | Create group chat (direct chats auto-created) |
| GET | `/api/chats/:id/messages` | Paginated messages |
| POST | `/api/chats/:id/messages` | Send text message |
| POST | `/api/messages/:id/read` | Mark message as read |

## WebSocket Events

Namespace: `/` (default).

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `chat:join` | `{ chatId }` | Join room `chat:<id>` |
| `chat:leave` | `{ chatId }` | Leave room |
| `message:send` | `{ chatId, content }` | Send message |
| `message:read` | `{ messageId }` | Mark message as read |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | Message object | New message in joined chat |
| `message:read` | `{ messageId, userId, readAt }` | Read receipt update |
| `user:presence` | `{ userId, isOnline, lastSeenAt }` | Online/offline status |

### Authentication

The client passes the JWT in the `token` query parameter when connecting. The server validates it before allowing `chat:join`.

## Localization (ru + en)

- Use `i18next` + `react-i18next` with JSON resource files in `src/i18n/{ru,en}.json`.
- Default language: device locale if supported, otherwise `ru`.
- Selected language is persisted locally (AsyncStorage) and synced to `User.preferredLanguage` on the server.
- Server error/push messages respect the client's `Accept-Language` header or the stored preference.

## Security

- Passwords hashed with Argon2id.
- JWT access tokens expire in 15 minutes, refresh tokens in 7 days.
- All client-server traffic over HTTPS in production and a local self-signed cert for dev.
- No message encryption at rest beyond Postgres; E2E encryption is a future consideration.

## Development Environment

- Monorepo managed with **pnpm workspaces** (root `pnpm-workspace.yaml` includes `apps/*`, `services/*`, `packages/*`).
- Backend run locally with `docker compose up` in `~/dev/pulse-chat`.
- Client run with `pnpm --filter mobile expo start` from `~/dev/pulse-chat`.
- Env files kept in `.env` and `.env.local`; `.env.example` is committed.

## Future Phase Sketches

### Phase 2 — Audio calls

- Add `Call` entity or reuse `Message` of type `call`.
- WebRTC peer connection with Socket.io signaling.
- STUN server from a public provider; TURN server (`coturn`) if direct P2P fails.
- UI: incoming/outgoing call screen, mute/hangup.

### Phase 3 — Built-in WireGuard VPN

- Deploy WireGuard on the same host as the VLESS portal (`~/dev/ru-vpn-hub` infrastructure).
- Backend endpoint `/api/vpn/config` returns a WireGuard peer config and server public key.
- Native modules:
  - iOS: `WireGuardKit` inside a `NetworkExtension` packet tunnel.
  - Android: `wireguard-android` / `WireGuardTunnel` via `VpnService`.
- RN bridge module exposes `connect(config)`, `disconnect()`, `getStatus()`.
- UI toggle in Profile tab shows connected/disconnected state.

## Open Decisions (to be resolved before implementation planning)

None. All decisions above were confirmed during brainstorming.

## Appendix: File Layout (planned)

```
~/dev/pulse-chat/
├── apps/
│   └── mobile/              # Expo + React Native
├── services/
│   └── api/                 # Node.js backend
├── packages/
│   ├── shared/              # shared types/constants
│   └── ts-config/           # shared tsconfig
├── docker-compose.yml
└── docs/superpowers/specs/  # this document
```

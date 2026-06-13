# Pulse Chat — Production MVP Design

- **Date:** 2026-06-13
- **Status:** Approved for implementation
- **Project root:** `~/dev/pulse-chat`

## Goal

Довести pet-проект до состояния, в котором его можно установить на телефон и использовать как корпоративный мессенджер с аудиозвонками и VPN, развёрнутый на собственном VDS.

## Scope

### In scope

- Аудиозвонки 1-to-1 через WebRTC (`react-native-webrtc`).
- Signaling через существующий Socket.io сервер.
- Собственный TURN-сервер (`coturn`) на том же VDS.
- Продакшен-деплой: Docker Compose, nginx reverse proxy, Let's Encrypt SSL.
- VPN: WireGuard-конфиг, выдаваемый API и импортируемый в системный WireGuard клиент через QR/файл.
- Мобильное приложение собирается через EAS Build с нативными модулями.

### Out of scope

- Видеозвонки.
- Групповые звонки.
- Автоматическое поднятие VPN-туннеля из приложения (ручной import конфига).
- Push-уведомления о входящем звонке в фоне.
- Desktop / web клиент.
- E2E-шифрование звонков и сообщений.

## Vibe

Сохраняем `calm-reliable` из Phase 1 polish: никакой паники, понятные статусы, минимум шагов.

## Architecture

```
┌─────────────────────────────────────────┐
│  iOS / Android (EAS Build)              │
│  React Native + react-native-webrtc     │
│  WireGuard config import (QR/file)      │
└──────────────┬──────────────────────────┘
               │ HTTPS / WSS
               ▼
┌─────────────────────────────────────────┐
│  VDS                                    │
│  ┌─────────────────────────────────┐    │
│  │  nginx                          │    │
│  │  api.pulse.chat   → api:4000    │    │
│  │  vpn.pulse.chat   → wg-easy     │    │
│  │  turn.pulse.chat  → coturn      │    │
│  └─────────────────────────────────┘    │
│  ┌────────┐ ┌────────┐ ┌──────────┐     │
│  │ API    │ │ coturn │ │ wg-easy  │     │
│  │ Node   │ │ TURN   │ │ WireGuard│     │
│  └────┬───┘ └────────┘ └──────────┘     │
│       │                                  │
│  ┌────┴───┐ ┌────────┐                  │
│  │PostgreSQL│ │ Redis  │                  │
│  └────────┘ └────────┘                  │
└─────────────────────────────────────────┘
```

## Backend

### Call signaling

Socket.io events (все payload проходят Zod-валидацию):

| Event | Direction | Payload |
|-------|-----------|---------|
| `call:offer` | caller → server → callee | `{ callId, toUserId, sdp }` |
| `call:answer` | callee → server → caller | `{ callId, sdp }` |
| `call:ice-candidate` | both → server → other | `{ callId, candidate }` |
| `call:hangup` | both → server → other | `{ callId }` |
| `call:reject` | callee → server → caller | `{ callId }` |
| `call:busy` | server → caller | `{ callId, toUserId }` |
| `call:timeout` | server → caller | `{ callId }` |

### Call state

In-memory store `CallSessionStore` в `src/lib/calls.ts`:

```ts
interface CallSession {
  callId: string;
  callerId: string;
  calleeId: string;
  status: 'dialing' | 'connected' | 'ended';
  startedAt?: Date;
  endedAt?: Date;
}
```

- Один пользователь может участвовать только в одном активном звонке.
- Таймаут входящего звонка — 30 секунд.
- При disconnect закрываем звонки, где участвовал пользователь.

### TURN credentials

`GET /api/turn/credentials` — возвращает short-lived credentials для coturn:

```ts
{
  urls: string[];
  username: string;
  credential: string;
}
```

Генерация по схеме coturn `hmac-key`: `username = timestamp:userId`, `credential = hmac-sha1(secret, username)`.

### ICE config

Клиент получает:

```ts
[
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:turn.pulse.chat:3478',
    username: '<timestamp:userId>',
    credential: '<hmac>',
  },
]
```

## Mobile

### Dependencies

```bash
pnpm add react-native-webrtc
```

### Call module

- `src/lib/webrtc.ts` — фабрика `RTCPeerConnection`, работа с `MediaStream`, ICE candidates.
- `src/hooks/useCall.ts` — управление полным циклом звонка.
- `src/components/CallScreen.tsx` — UI входящего/исходящего/активного звонка.
- `src/components/IncomingCallModal.tsx` — overlay поверх любого экрана.

### Permissions

```json
{
  "android": {
    "permissions": ["android.permission.RECORD_AUDIO"]
  },
  "ios": {
    "infoPlist": {
      "NSMicrophoneUsageDescription": "Pulse Chat uses the microphone for audio calls."
    }
  }
}
```

### UI flow

1. User открывает Contact / Chat → кнопка звонка.
2. `CallScreen` открывается в модальном стеке.
3. Caller видит "Calling...", callee видит IncomingCallModal.
4. После answer — активный звонок с mute/hangup.
5. После hangup — оба возвращаются назад.

## Deployment

### Production compose

`docker-compose.prod.yml`:

- `api` — сборка из `Dockerfile`, `NODE_ENV=production`.
- `postgres`, `redis` — как сейчас.
- `wireguard` — `wg-easy` с `WG_HOST=vpn.pulse.chat`.
- `coturn` — отдельный сервис.
- `nginx` — reverse proxy + certbot для SSL.

### API Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run db:generate && pnpm run build
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### Environment

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGIN=https://api.pulse.chat
TURN_SECRET=...
WG_SERVER_PUBLIC_KEY=...
WG_ENDPOINT=vpn.pulse.chat:51820
WG_NETWORK=10.200.0.0/24
```

### SSL

Certbot + nginx. Домены:
- `api.pulse.chat`
- `vpn.pulse.chat`
- `turn.pulse.chat`

## Security

- TURN credentials — time-limited HMAC.
- WebRTC — DTLS-SRTP для медиа.
- Signaling — JWT через Socket.io auth middleware.
- VPN private keys генерируются на устройстве.
- API доступен только по HTTPS.

## Testing

- Backend: socket-тесты для offer/answer/hangup.
- Mobile: lint + ручное тестирование звонка.
- Deployment: `docker compose -f docker-compose.prod.yml config`.

## Success criteria

1. Два пользователя на разных телефонах звонят друг другу через VDS.
2. Звук идёт P2P или через TURN.
3. Можно получить WireGuard-конфиг и импортировать его.
4. Приложение собирается через EAS Build и устанавливается на телефон.
5. Все тесты backend проходят.

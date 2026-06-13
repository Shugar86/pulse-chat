# Pulse Chat — Production MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить аудиозвонки 1-to-1 через WebRTC, собственный TURN, продакшен Docker Compose с nginx/SSL, и подготовить мобильное приложение к EAS Build с нативными модулями.

**Architecture:**
- Signaling звонков — Socket.io поверх существующего websocket-соединения.
- Медиа — WebRTC P2P с публичными STUN и собственным TURN (coturn) на VDS.
- Состояние звонков — in-memory per-node store; для MVP не используем Redis adapter.
- Деплой — Docker Compose production файл с nginx reverse proxy и Let's Encrypt.
- VPN — ручной import конфига в системный WireGuard клиент (QR/file).

**Tech Stack:** React Native, Expo, react-native-webrtc, Socket.io, Node.js, Express, WebRTC, coturn, wg-easy, nginx, certbot, Docker Compose.

---

## File Structure

### Backend

| File | Responsibility |
|------|----------------|
| `services/api/src/lib/calls.ts` | NEW. In-memory call session store и helpers. |
| `services/api/src/lib/turn.ts` | NEW. Генерация HMAC credentials для coturn. |
| `services/api/src/routes/turn.ts` | NEW. `GET /api/turn/credentials`. |
| `services/api/src/lib/socket.ts` | Добавить обработчики call events. |
| `services/api/src/config.ts` | Добавить `TURN_SECRET`, `TURN_HOST`. |
| `services/api/tests/calls.test.ts` | NEW. Socket-тесты звонков. |
| `services/api/Dockerfile` | NEW. Продакшен сборка API. |

### Mobile

| File | Responsibility |
|------|----------------|
| `apps/mobile/package.json` | Добавить `react-native-webrtc`. |
| `apps/mobile/app.json` | Permissions для микрофона, bundle ids. |
| `apps/mobile/src/lib/webrtc.ts` | NEW. RTCPeerConnection helpers. |
| `apps/mobile/src/hooks/useCall.ts` | NEW. Управление звонком. |
| `apps/mobile/src/components/CallScreen.tsx` | NEW. UI звонка. |
| `apps/mobile/src/components/IncomingCallModal.tsx` | NEW. Overlay входящего звонка. |
| `apps/mobile/src/navigation/types.ts` | Добавить `Call` в стек. |
| `apps/mobile/src/navigation/AppNavigator.tsx` | Модальный стек для звонка. |
| `apps/mobile/src/screens/ContactsScreen.tsx` | Кнопка звонка у контакта. |
| `apps/mobile/src/screens/ChatScreen.tsx` | Кнопка звонка в шапке чата. |
| `apps/mobile/src/i18n/locales/*.json` | Ключи для звонков. |

### Deployment

| File | Responsibility |
|------|----------------|
| `docker-compose.prod.yml` | NEW. Продакшен compose: nginx, api, postgres, redis, coturn, wg-easy. |
| `deploy/nginx/nginx.conf` | NEW. Reverse proxy config. |
| `deploy/nginx/init-ssl.sh` | NEW. Certbot init script. |
| `services/api/.env.example` | Дополнить TURN переменные. |
| `.env.example` | Дополнить TURN и домены. |
| `README.md` | Инструкция по деплою. |

---

## Task 1: Backend call session store and TURN credentials

**Files:**
- Create: `services/api/src/lib/calls.ts`
- Create: `services/api/src/lib/turn.ts`
- Create: `services/api/src/routes/turn.ts`
- Modify: `services/api/src/routes/index.ts`
- Modify: `services/api/src/config.ts`
- Test: `services/api/tests/turn.test.ts`

- [ ] **Step 1: Add TURN config env vars**

Modify `services/api/src/config.ts`:

1. Add to envSchema:

```ts
TURN_SECRET: z.string().min(1).default('change-me-turn-secret'),
TURN_HOST: z.string().min(1).default('turn.localhost'),
TURN_PORT: z.coerce.number().int().min(1).default(3478),
```

2. Add to exported config:

```ts
turn: {
  secret: env.TURN_SECRET,
  host: env.TURN_HOST,
  port: env.TURN_PORT,
},
```

- [ ] **Step 2: Create TURN credentials helper**

Create `services/api/src/lib/turn.ts`:

```ts
import crypto from 'node:crypto';
import { config } from '../config.js';

export function generateTurnCredentials(userId: string) {
  const ttl = 24 * 60 * 60; // 24 hours
  const timestamp = Math.floor(Date.now() / 1000) + ttl;
  const username = `${timestamp}:${userId}`;
  const hmac = crypto.createHmac('sha1', config.turn.secret);
  hmac.update(username);
  const credential = hmac.digest('base64');
  return {
    username,
    credential,
    urls: [`turn:${config.turn.host}:${config.turn.port}`],
  };
}
```

- [ ] **Step 3: Create TURN route**

Create `services/api/src/routes/turn.ts`:

```ts
import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { generateTurnCredentials } from '../lib/turn.js';

export const turnRouter: Router = Router();

turnRouter.use(requireAuth);

turnRouter.get('/credentials', (req: AuthRequest, res) => {
  const creds = generateTurnCredentials(req.user!.userId);
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: creds.urls[0],
        username: creds.username,
        credential: creds.credential,
      },
    ],
  });
});
```

- [ ] **Step 4: Mount turn router**

Modify `services/api/src/routes/index.ts`:

```ts
import { turnRouter } from './turn.js';
routes.use('/turn', turnRouter);
```

- [ ] **Step 5: Create call session store**

Create `services/api/src/lib/calls.ts`:

```ts
export type CallStatus = 'dialing' | 'connected' | 'ended';

export interface CallSession {
  callId: string;
  callerId: string;
  calleeId: string;
  status: CallStatus;
  startedAt?: Date;
  endedAt?: Date;
}

const sessions = new Map<string, CallSession>();
const activeUserCalls = new Map<string, string>(); // userId -> callId

export function createCallSession(callId: string, callerId: string, calleeId: string): CallSession | null {
  if (activeUserCalls.has(callerId) || activeUserCalls.has(calleeId)) return null;
  const session: CallSession = { callId, callerId, calleeId, status: 'dialing' };
  sessions.set(callId, session);
  activeUserCalls.set(callerId, callId);
  activeUserCalls.set(calleeId, callId);
  return session;
}

export function getCallSession(callId: string): CallSession | undefined {
  return sessions.get(callId);
}

export function connectCallSession(callId: string): boolean {
  const session = sessions.get(callId);
  if (!session || session.status !== 'dialing') return false;
  session.status = 'connected';
  session.startedAt = new Date();
  return true;
}

export function endCallSession(callId: string): CallSession | undefined {
  const session = sessions.get(callId);
  if (!session) return undefined;
  session.status = 'ended';
  session.endedAt = new Date();
  activeUserCalls.delete(session.callerId);
  activeUserCalls.delete(session.calleeId);
  return session;
}

export function getActiveCallId(userId: string): string | undefined {
  return activeUserCalls.get(userId);
}
```

- [ ] **Step 6: Test TURN credentials endpoint**

Create `services/api/tests/turn.test.ts`:

```ts
import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';

const app = createApp();

async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, displayName, tenantName: displayName });
  return {
    user: res.body.user,
    tenantId: res.body.user.tenants[0].tenantId,
    token: res.body.tokens.accessToken,
  };
}

beforeEach(async () => {
  await prisma.vpnPeer.deleteMany();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('TURN credentials', () => {
  it('returns ice servers for authenticated user', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .get('/api/turn/credentials')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId);
    expect(res.status).toBe(200);
    expect(res.body.iceServers).toBeDefined();
    expect(res.body.iceServers.length).toBeGreaterThanOrEqual(3);
    const turn = res.body.iceServers.find((s: any) => s.urls.startsWith('turn:'));
    expect(turn.username).toBeDefined();
    expect(turn.credential).toBeDefined();
  });
});
```

Run: `cd services/api && pnpm test -- --testPathPattern=turn.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add services/api/src/lib/calls.ts services/api/src/lib/turn.ts services/api/src/routes/turn.ts services/api/src/routes/index.ts services/api/src/config.ts services/api/tests/turn.test.ts
git commit -m "feat(api): add call session store and TURN credentials endpoint"
```

---

## Task 2: Backend Socket.io call signaling

**Files:**
- Modify: `services/api/src/lib/socket.ts`
- Test: `services/api/tests/calls.test.ts`

- [ ] **Step 1: Add call event handlers**

Modify `services/api/src/lib/socket.ts`. After existing message handlers, add:

```ts
import { z } from 'zod';
import { createCallSession, getCallSession, connectCallSession, endCallSession, getActiveCallId } from './calls.js';

const offerSchema = z.object({ callId: z.string().uuid(), toUserId: z.string().uuid(), sdp: z.string().min(1) });
const answerSchema = z.object({ callId: z.string().uuid(), sdp: z.string().min(1) });
const iceCandidateSchema = z.object({ callId: z.string().uuid(), candidate: z.record(z.any()) });
const callIdSchema = z.object({ callId: z.string().uuid() });

const CALL_TIMEOUT_MS = 30000;

function setupCallHandlers(io: Server, socket: Socket, userId: string) {
  socket.on('call:offer', async (data) => {
    try {
      const { callId, toUserId, sdp } = offerSchema.parse(data);
      if (toUserId === userId) return socket.emit('error', { message: 'Cannot call yourself' });
      const session = createCallSession(callId, userId, toUserId);
      if (!session) return socket.emit('call:busy', { callId, toUserId });

      io.to(`user:${toUserId}`).emit('call:incoming', { callId, fromUserId: userId, sdp });

      setTimeout(() => {
        const s = getCallSession(callId);
        if (s && s.status === 'dialing') {
          endCallSession(callId);
          io.to(`user:${s.callerId}`).emit('call:timeout', { callId });
          io.to(`user:${s.calleeId}`).emit('call:timeout', { callId });
        }
      }, CALL_TIMEOUT_MS);
    } catch {
      socket.emit('error', { message: 'Invalid call:offer payload' });
    }
  });

  socket.on('call:answer', (data) => {
    try {
      const { callId, sdp } = answerSchema.parse(data);
      const session = getCallSession(callId);
      if (!session || session.calleeId !== userId) return socket.emit('error', { message: 'Call not found' });
      if (!connectCallSession(callId)) return socket.emit('error', { message: 'Call not in dialing state' });
      io.to(`user:${session.callerId}`).emit('call:answer', { callId, sdp });
    } catch {
      socket.emit('error', { message: 'Invalid call:answer payload' });
    }
  });

  socket.on('call:ice-candidate', (data) => {
    try {
      const { callId, candidate } = iceCandidateSchema.parse(data);
      const session = getCallSession(callId);
      if (!session || (session.callerId !== userId && session.calleeId !== userId)) {
        return socket.emit('error', { message: 'Call not found' });
      }
      const toUserId = session.callerId === userId ? session.calleeId : session.callerId;
      io.to(`user:${toUserId}`).emit('call:ice-candidate', { callId, candidate });
    } catch {
      socket.emit('error', { message: 'Invalid call:ice-candidate payload' });
    }
  });

  socket.on('call:hangup', (data) => {
    try {
      const { callId } = callIdSchema.parse(data);
      const session = getCallSession(callId);
      if (!session || (session.callerId !== userId && session.calleeId !== userId)) {
        return socket.emit('error', { message: 'Call not found' });
      }
      endCallSession(callId);
      const otherUserId = session.callerId === userId ? session.calleeId : session.callerId;
      io.to(`user:${otherUserId}`).emit('call:hangup', { callId });
    } catch {
      socket.emit('error', { message: 'Invalid call:hangup payload' });
    }
  });

  socket.on('call:reject', (data) => {
    try {
      const { callId } = callIdSchema.parse(data);
      const session = getCallSession(callId);
      if (!session || session.calleeId !== userId) return socket.emit('error', { message: 'Call not found' });
      endCallSession(callId);
      io.to(`user:${session.callerId}`).emit('call:reject', { callId });
    } catch {
      socket.emit('error', { message: 'Invalid call:reject payload' });
    }
  });

  socket.on('disconnect', () => {
    const callId = getActiveCallId(userId);
    if (callId) {
      const session = endCallSession(callId);
      if (session) {
        const otherUserId = session.callerId === userId ? session.calleeId : session.callerId;
        io.to(`user:${otherUserId}`).emit('call:hangup', { callId });
      }
    }
  });
}
```

Call `setupCallHandlers(io, socket, userId)` inside `io.on('connection', ...)`.

- [ ] **Step 2: Add socket tests for calls**

Create `services/api/tests/calls.test.ts`:

```ts
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { createApp, createHttpServer, createIOServer } from '../src/server';
import { setupSocketHandlers } from '../src/lib/socket';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const httpServer = createHttpServer(app);
const io = createIOServer(httpServer);
setupSocketHandlers(io);

beforeAll((done) => {
  httpServer.listen(0, done);
});

afterAll(async () => {
  io.close();
  httpServer.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.vpnPeer.deleteMany();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});

async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, displayName, tenantName: displayName });
  return {
    user: res.body.user,
    tenantId: res.body.user.tenants[0].tenantId,
    token: res.body.tokens.accessToken,
  };
}

function connectSocket(token: string, tenantId: string): Promise<ClientSocket> {
  return new Promise((resolve) => {
    const port = (httpServer.address() as any).port;
    const socket = ClientIO(`http://localhost:${port}`, {
      auth: { token, tenantId },
    });
    socket.on('connect', () => resolve(socket));
  });
}

describe('Call signaling', () => {
  it('forwards offer to callee and answer back to caller', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    const aliceSocket = await connectSocket(alice.token, alice.tenantId);
    const bobSocket = await connectSocket(bob.token, bob.tenantId);

    const incoming = new Promise<any>((resolve) => bobSocket.on('call:incoming', resolve));
    const answerBack = new Promise<any>((resolve) => aliceSocket.on('call:answer', resolve));

    const callId = '11111111-1111-1111-1111-111111111111';
    aliceSocket.emit('call:offer', { callId, toUserId: bob.user.id, sdp: 'offer-sdp' });

    const inc = await incoming;
    expect(inc.callId).toBe(callId);
    expect(inc.sdp).toBe('offer-sdp');

    bobSocket.emit('call:answer', { callId, sdp: 'answer-sdp' });
    const ans = await answerBack;
    expect(ans.sdp).toBe('answer-sdp');

    aliceSocket.close();
    bobSocket.close();
  });
});
```

Run: `cd services/api && pnpm test -- --testPathPattern=calls.test.ts`
Expected: PASS.

- [ ] **Step 3: Run full backend tests**

Run: `cd services/api && pnpm test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/lib/socket.ts services/api/tests/calls.test.ts
git commit -m "feat(api): add Socket.io call signaling handlers"
```

---

## Task 3: Mobile WebRTC integration

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`
- Create: `apps/mobile/src/lib/webrtc.ts`
- Create: `apps/mobile/src/hooks/useCall.ts`

- [ ] **Step 1: Install react-native-webrtc**

Run:

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm add react-native-webrtc
```

- [ ] **Step 2: Add native permissions**

Modify `apps/mobile/app.json`:

```json
{
  "expo": {
    ...
    "android": {
      "package": "chat.pulse.mobile",
      "permissions": ["android.permission.RECORD_AUDIO"],
      "adaptiveIcon": { "backgroundColor": "#1a2230" }
    },
    "ios": {
      "bundleIdentifier": "chat.pulse.mobile",
      "supportsTablet": true,
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Pulse Chat uses the microphone for audio calls."
      }
    },
    "plugins": [
      "expo-secure-store",
      ["react-native-wireguard-vpn", {}]
    ]
  }
}
```

- [ ] **Step 3: Create WebRTC helpers**

Create `apps/mobile/src/lib/webrtc.ts`:

```ts
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';

export interface IceServersResponse {
  iceServers: Array<{ urls: string; username?: string; credential?: string }>;
}

export async function getUserAudioStream(): Promise<MediaStream> {
  return mediaDevices.getUserMedia({ audio: true, video: false }) as Promise<MediaStream>;
}

export function createPeerConnection(iceServers: any[]): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers });
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescription> {
  return pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
}

export async function createAnswer(pc: RTCPeerConnection): Promise<RTCSessionDescription> {
  return pc.createAnswer();
}

export async function setLocalDescription(pc: RTCPeerConnection, desc: RTCSessionDescription) {
  await pc.setLocalDescription(desc);
}

export async function setRemoteDescription(pc: RTCPeerConnection, desc: RTCSessionDescription) {
  await pc.setRemoteDescription(desc);
}

export async function addIceCandidate(pc: RTCPeerConnection, candidate: any) {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}
```

- [ ] **Step 4: Create useCall hook**

Create `apps/mobile/src/hooks/useCall.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { RTCPeerConnection, RTCSessionDescription, MediaStream } from 'react-native-webrtc';
import { useSocket } from '../context/SocketContext';
import { api } from '../api/client';
import {
  createPeerConnection,
  createOffer,
  createAnswer,
  setLocalDescription,
  setRemoteDescription,
  addIceCandidate,
  getUserAudioStream,
  IceServersResponse,
} from '../lib/webrtc';

export type CallState = 'idle' | 'dialing' | 'incoming' | 'connected' | 'ended' | 'busy' | 'rejected' | 'timeout';

export function useCall() {
  const socket = useSocket();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [callId, setCallId] = useState<string | null>(null);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);

  const closeCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setCallState('ended');
  }, []);

  const startCall = useCallback(async (toUserId: string) => {
    if (!socket) throw new Error('Socket not connected');
    const id = crypto.randomUUID();
    setCallId(id);
    setRemoteUserId(toUserId);
    setCallState('dialing');

    const { data } = await api.get<IceServersResponse>('/turn/credentials');
    const pc = createPeerConnection(data.iceServers);
    pcRef.current = pc;

    const local = await getUserAudioStream();
    localStreamRef.current = local;
    local.getAudioTracks().forEach((track) => pc.addTrack(track, local));

    pc.ontrack = (event: any) => {
      remoteStreamRef.current = event.streams[0];
    };

    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        socket.emit('call:ice-candidate', { callId: id, candidate: event.candidate.toJSON() });
      }
    };

    const offer = await createOffer(pc);
    await setLocalDescription(pc, offer);
    socket.emit('call:offer', { callId: id, toUserId, sdp: offer.sdp });
  }, [socket]);

  const acceptCall = useCallback(async (incomingCallId: string, fromUserId: string, offerSdp: string) => {
    if (!socket) throw new Error('Socket not connected');
    setCallId(incomingCallId);
    setRemoteUserId(fromUserId);
    setCallState('incoming');

    const { data } = await api.get<IceServersResponse>('/turn/credentials');
    const pc = createPeerConnection(data.iceServers);
    pcRef.current = pc;

    const local = await getUserAudioStream();
    localStreamRef.current = local;
    local.getAudioTracks().forEach((track) => pc.addTrack(track, local));

    pc.ontrack = (event: any) => {
      remoteStreamRef.current = event.streams[0];
    };

    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        socket.emit('call:ice-candidate', { callId: incomingCallId, candidate: event.candidate.toJSON() });
      }
    };

    await setRemoteDescription(pc, new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
    const answer = await createAnswer(pc);
    await setLocalDescription(pc, answer);
    socket.emit('call:answer', { callId: incomingCallId, sdp: answer.sdp });
    setCallState('connected');
  }, [socket]);

  const hangUp = useCallback(() => {
    if (callId && socket) {
      socket.emit('call:hangup', { callId });
    }
    closeCall();
  }, [callId, socket, closeCall]);

  const rejectCall = useCallback(() => {
    if (callId && socket) {
      socket.emit('call:reject', { callId });
    }
    closeCall();
  }, [callId, socket, closeCall]);

  useEffect(() => {
    if (!socket) return;

    const onAnswer = async ({ callId: id, sdp }: { callId: string; sdp: string }) => {
      if (id !== callId || !pcRef.current) return;
      await setRemoteDescription(pcRef.current, new RTCSessionDescription({ type: 'answer', sdp }));
      setCallState('connected');
    };

    const onIceCandidate = async ({ callId: id, candidate }: { callId: string; candidate: any }) => {
      if (id !== callId || !pcRef.current) return;
      await addIceCandidate(pcRef.current, candidate);
    };

    const onHangUp = ({ callId: id }: { callId: string }) => {
      if (id !== callId) return;
      closeCall();
    };

    const onReject = ({ callId: id }: { callId: string }) => {
      if (id !== callId) return;
      setCallState('rejected');
      closeCall();
    };

    const onTimeout = ({ callId: id }: { callId: string }) => {
      if (id !== callId) return;
      setCallState('timeout');
      closeCall();
    };

    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:hangup', onHangUp);
    socket.on('call:reject', onReject);
    socket.on('call:timeout', onTimeout);

    return () => {
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:hangup', onHangUp);
      socket.off('call:reject', onReject);
      socket.off('call:timeout', onTimeout);
    };
  }, [socket, callId, closeCall]);

  return {
    callState,
    callId,
    remoteUserId,
    startCall,
    acceptCall,
    hangUp,
    rejectCall,
    localStream: localStreamRef.current,
    remoteStream: remoteStreamRef.current,
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/src/lib/webrtc.ts apps/mobile/src/hooks/useCall.ts
git commit -m "feat(mobile): add react-native-webrtc and useCall hook"
```

---

## Task 4: Mobile call UI and navigation

**Files:**
- Create: `apps/mobile/src/components/CallScreen.tsx`
- Create: `apps/mobile/src/components/IncomingCallModal.tsx`
- Modify: `apps/mobile/src/navigation/types.ts`
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`
- Modify: `apps/mobile/src/screens/ContactsScreen.tsx`
- Modify: `apps/mobile/src/screens/ChatScreen.tsx`
- Modify: `apps/mobile/src/i18n/locales/*.json`

- [ ] **Step 1: Create CallScreen component**

Create `apps/mobile/src/components/CallScreen.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { colors, spacing, typography } from '../theme';

interface CallScreenProps {
  title: string;
  subtitle: string;
  onHangUp: () => void;
  onAccept?: () => void;
}

export function CallScreen({ title, subtitle, onHangUp, onAccept }: CallScreenProps) {
  return (
    <View style={styles.container}>
      <Avatar name={title} size="lg" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.gap} />
      {onAccept ? (
        <View style={styles.row}>
          <Button title="Accept" onPress={onAccept} variant="secondary" style={styles.button} />
          <Button title="Decline" onPress={onHangUp} variant="danger" style={styles.button} />
        </View>
      ) : (
        <Button title="Hang up" onPress={onHangUp} variant="danger" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { ...typography.h2, marginTop: spacing.lg },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  gap: { height: spacing['3xl'] },
  row: { flexDirection: 'row', gap: spacing.md },
  button: { flex: 1 },
});
```

- [ ] **Step 2: Create IncomingCallModal**

Create `apps/mobile/src/components/IncomingCallModal.tsx`:

```tsx
import React from 'react';
import { Modal } from 'react-native';
import { CallScreen } from './CallScreen';

interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({ visible, callerName, onAccept, onDecline }: IncomingCallModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <CallScreen title={callerName} subtitle="Incoming call" onHangUp={onDecline} onAccept={onAccept} />
    </Modal>
  );
}
```

- [ ] **Step 3: Add Call route to navigation**

Modify `apps/mobile/src/navigation/types.ts`:

```ts
export type MainStackParamList = {
  MainTabs: undefined;
  Call: { userId: string; displayName: string; incoming?: boolean; callId?: string; sdp?: string };
};
```

Modify `apps/mobile/src/navigation/AppNavigator.tsx`:

1. Add imports:

```tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainNavigator } from './MainNavigator';
import { CallScreen } from '../components/CallScreen';
import type { MainStackParamList } from './types';
```

2. Replace current `MainNavigator` usage with:

```tsx
const Stack = createNativeStackNavigator<MainStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainNavigator} />
        <Stack.Screen name="Call" component={CallScreen} options={{ animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

3. Wire incoming call listener at the root level. For MVP, create a `CallProvider` wrapper or place listener in `AppNavigator` using `useSocket`.

- [ ] **Step 4: Add call buttons to Contacts and Chat**

Modify `apps/mobile/src/screens/ContactsScreen.tsx`:

In `renderContactItem`, add an `IconButton` with icon `call` next to existing actions. On press: `navigation.navigate('Call', { userId: item.target.id, displayName: item.target.displayName })`.

Modify `apps/mobile/src/screens/ChatScreen.tsx`:

In header, add `IconButton` with icon `call` trailing. On press: `navigation.navigate('Call', { userId: otherUserId, displayName: title })`.

- [ ] **Step 5: Add i18n keys**

Add to `en.json` and `ru.json`:

```json
{
  "calling": "Calling...",
  "incomingCall": "Incoming call",
  "callInProgress": "Call in progress",
  "accept": "Accept",
  "decline": "Decline",
  "hangUp": "Hang up"
}
```

For Russian:

```json
{
  "calling": "Звоним...",
  "incomingCall": "Входящий звонок",
  "callInProgress": "Разговор",
  "accept": "Принять",
  "decline": "Отклонить",
  "hangUp": "Завершить"
}
```

- [ ] **Step 6: Run lint and commit**

Run: `cd apps/mobile && pnpm lint`
Expected: PASS.

```bash
git add apps/mobile/src/components/CallScreen.tsx apps/mobile/src/components/IncomingCallModal.tsx apps/mobile/src/navigation/types.ts apps/mobile/src/navigation/AppNavigator.tsx apps/mobile/src/screens/ContactsScreen.tsx apps/mobile/src/screens/ChatScreen.tsx apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/ru.json
git commit -m "feat(mobile): call screen, incoming modal, navigation and call buttons"
```

---

## Task 5: Wire up global call state and incoming call handling

**Files:**
- Create: `apps/mobile/src/context/CallContext.tsx`
- Modify: `apps/mobile/src/App.tsx`
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Create CallContext**

Create `apps/mobile/src/context/CallContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useCall } from '../hooks/useCall';
import { IncomingCallModal } from '../components/IncomingCallModal';

interface IncomingCall {
  callId: string;
  fromUserId: string;
  displayName: string;
  sdp: string;
}

const CallContext = createContext<ReturnType<typeof useCall> | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const socket = useSocket();
  const call = useCall();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onIncoming = ({ callId, fromUserId, sdp }: any) => {
      setIncoming({ callId, fromUserId, displayName: fromUserId, sdp });
    };
    socket.on('call:incoming', onIncoming);
    return () => { socket.off('call:incoming', onIncoming); };
  }, [socket]);

  const handleAccept = useCallback(async () => {
    if (!incoming) return;
    await call.acceptCall(incoming.callId, incoming.fromUserId, incoming.sdp);
    setIncoming(null);
  }, [incoming, call]);

  const handleDecline = useCallback(() => {
    if (!incoming) return;
    call.rejectCall();
    setIncoming(null);
  }, [incoming, call]);

  return (
    <CallContext.Provider value={call}>
      {children}
      <IncomingCallModal
        visible={!!incoming}
        callerName={incoming?.displayName || ''}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </CallContext.Provider>
  );
}

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCallContext must be used within CallProvider');
  return ctx;
}
```

- [ ] **Step 2: Wrap app with CallProvider**

Modify `apps/mobile/src/App.tsx`:

```tsx
<SocketProvider>
  <CallProvider>
    <AppNavigator />
  </CallProvider>
</SocketProvider>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/context/CallContext.tsx apps/mobile/src/App.tsx
git commit -m "feat(mobile): global call context and incoming call handling"
```

---

## Task 6: Production Docker Compose and deployment

**Files:**
- Create: `services/api/Dockerfile`
- Create: `docker-compose.prod.yml`
- Create: `deploy/nginx/nginx.conf`
- Create: `deploy/nginx/init-ssl.sh`
- Modify: `services/api/.env.example`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Create API Dockerfile**

Create `services/api/Dockerfile`:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run db:generate
RUN pnpm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.pnpm/@prisma+client* ./node_modules/.pnpm/
COPY --from=builder /app/prisma ./prisma
RUN pnpm exec prisma generate
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

Note: Prisma client path may need adjustment based on pnpm structure. Simplify if needed.

- [ ] **Step 2: Create production compose**

Create `docker-compose.prod.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./services/api
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      CORS_ORIGIN: ${CORS_ORIGIN}
      TURN_SECRET: ${TURN_SECRET}
      TURN_HOST: ${TURN_HOST}
      WG_SERVER_PUBLIC_KEY: ${WG_SERVER_PUBLIC_KEY}
      WG_ENDPOINT: ${WG_ENDPOINT}
      WG_NETWORK: ${WG_NETWORK}
      WG_SYNC_DIR: /sync
    volumes:
      - ${WG_SYNC_DIR}:/sync
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  coturn:
    image: coturn/coturn
    environment:
      TURN_SECRET: ${TURN_SECRET}
    command: >
      turnserver
      --realm=${TURN_HOST}
      --fingerprint
      --listening-port=3478
      --min-port=10000
      --max-port=20000
      --verbose
      --static-auth-secret=${TURN_SECRET}
      --userdb=/var/lib/coturn/turndb
    ports:
      - '3478:3478/tcp'
      - '3478:3478/udp'
      - '10000-20000:10000-20000/udp'
    restart: unless-stopped

  wireguard:
    image: ghcr.io/wg-easy/wg-easy
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    sysctls:
      - net.ipv4.conf.all.src_valid_mark=1
      - net.ipv4.ip_forward=1
    environment:
      WG_HOST: ${WG_HOST}
      PASSWORD: ${WG_PASSWORD}
      WG_PORT: ${WG_PORT}
      WG_DEFAULT_DNS: ${WG_DNS}
      WG_ALLOWED_IPS: ${WG_ALLOWED_IPS}
      WG_PERSISTENT_KEEPALIVE: 25
    ports:
      - '${WG_PORT}:${WG_PORT}/udp'
      - '51821:51821/tcp'
    volumes:
      - wireguard_data:/etc/wireguard
      - ${WG_SYNC_DIR}:/sync:ro
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./deploy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./deploy/certbot/conf:/etc/letsencrypt:ro
      - ./deploy/certbot/www:/var/www/certbot:ro
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
  wireguard_data:
```

- [ ] **Step 3: Create nginx config**

Create `deploy/nginx/nginx.conf`:

```nginx
events {
  worker_connections 1024;
}

http {
  server {
    listen 80;
    server_name api.pulse.chat;
    location /.well-known/acme-challenge/ {
      root /var/www/certbot;
    }
    location / {
      return 301 https://$host$request_uri;
    }
  }

  server {
    listen 443 ssl http2;
    server_name api.pulse.chat;

    ssl_certificate /etc/letsencrypt/live/api.pulse.chat/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.pulse.chat/privkey.pem;

    location / {
      proxy_pass http://api:4000;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
}
```

- [ ] **Step 4: Create SSL init script**

Create `deploy/nginx/init-ssl.sh`:

```bash
#!/bin/bash
set -e

domains=(api.pulse.chat)
rsa_key_size=4096
data_path="./deploy/certbot"
email="admin@pulse.chat"

if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
fi

for domain in "${domains[@]}"; do
  mkdir -p "$data_path/www/$domain"
done

docker compose -f docker-compose.prod.yml up -d nginx

docker run -it --rm \
  -v "$PWD/deploy/certbot/conf:/etc/letsencrypt" \
  -v "$PWD/deploy/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  --email "$email" \
  -d api.pulse.chat \
  --agree-tos --non-interactive

docker compose -f docker-compose.prod.yml restart nginx
```

- [ ] **Step 5: Update env examples**

Add to `services/api/.env.example`:

```bash
TURN_SECRET=change-me-turn-secret
TURN_HOST=turn.pulse.chat
TURN_PORT=3478
```

Add to `.env.example`:

```bash
# TURN
TURN_SECRET=change-me-turn-secret
TURN_HOST=turn.pulse.chat

# Domains
API_DOMAIN=api.pulse.chat
VPN_DOMAIN=vpn.pulse.chat
TURN_DOMAIN=turn.pulse.chat
```

- [ ] **Step 6: Update README with deploy instructions**

Append to README:

```markdown
## Production deployment

1. Point domains `api.pulse.chat`, `vpn.pulse.chat`, `turn.pulse.chat` to your VDS.
2. Copy `.env.example` to `.env` and fill all secrets.
3. Run `bash deploy/nginx/init-ssl.sh` to obtain certificates.
4. Start services: `docker compose -f docker-compose.prod.yml up -d`.
5. Build mobile app with `EXPO_PUBLIC_API_URL=https://api.pulse.chat`.
```

- [ ] **Step 7: Validate compose and commit**

Run:

```bash
cd /home/shugar/dev/pulse-chat && docker compose -f docker-compose.prod.yml config > /dev/null
```

Expected: exits 0.

```bash
git add services/api/Dockerfile docker-compose.prod.yml deploy/nginx/nginx.conf deploy/nginx/init-ssl.sh services/api/.env.example .env.example README.md
git commit -m "infra: production docker compose, nginx, coturn and ssl setup"
```

---

## Task 7: Final verification and polish

**Files:**
- All

- [ ] **Step 1: Run full test suite**

```bash
cd /home/shugar/dev/pulse-chat && pnpm test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

```bash
cd apps/mobile && pnpm lint
cd services/api && pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Commit lockfile updates if needed**

```bash
git add pnpm-lock.yaml 2>/dev/null || true
git diff --cached --quiet || git commit -m "chore: update lockfile"
```

- [ ] **Step 4: Final report**

Report final status DONE with summary.

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| TURN credentials | Task 1 |
| Call session store | Task 1 |
| Socket signaling | Task 2 |
| Mobile WebRTC | Task 3 |
| Call UI | Task 4 |
| Global call state | Task 5 |
| Production deploy | Task 6 |
| Verification | Task 7 |

### Placeholder scan

- No TBD/TODO.
- All code blocks contain concrete code.

### Type consistency

- `useCall` returns consistent state types.
- Socket events match between backend and mobile.

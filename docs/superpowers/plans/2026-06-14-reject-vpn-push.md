# Fix reject + auto VPN tunnel + Android push notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Исправить отклонение входящего звонка, сделать автоматическое подключение VPN из приложения и добавить push-уведомления на Android о входящих звонках.

**Architecture:**
- `useCall` становится stateless по `callId`: все методы принимают/возвращают идентификатор звонка, reject корректно работает из incoming-модалки.
- Приватный ключ VPN хранится в `expo-secure-store`; при подключении к `react-native-wireguard-vpn` передаётся полный конфиг с `PrivateKey`.
- Push-токены FCM сохраняются в `PushToken` Prisma-модели; при входящем `call:offer` сервер шлёт push через `firebase-admin` если получатель не в сети.

**Tech Stack:** React Native, Expo, react-native-wireguard-vpn, expo-secure-store, expo-notifications, Firebase Cloud Messaging, Socket.io, Node.js, Prisma, firebase-admin.

---

## File Structure

### Backend

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | Добавить `PushToken` модель. |
| `src/routes/push.ts` | NEW. `POST /api/push/register`, `DELETE /api/push/unregister`. |
| `src/lib/push.ts` | NEW. Отправка push через firebase-admin. |
| `src/lib/socket.ts` | При `call:offer` отправлять push callee если не в сети. |
| `src/config.ts` | `FIREBASE_SERVICE_ACCOUNT` env. |
| `src/routes/index.ts` | Монтирование `/push`. |
| `package.json` | Добавить `firebase-admin`. |
| `.env.example` | `FIREBASE_SERVICE_ACCOUNT`. |
| `tests/push.test.ts` | NEW. Тесты регистрации токена. |

### Mobile

| File | Responsibility |
|------|----------------|
| `package.json` | `expo-secure-store`, `expo-notifications`. |
| `app.json` | Плагины secure-store и notifications. |
| `src/hooks/useCall.ts` | Переписать на передачу callId. |
| `src/context/CallContext.tsx` | Обновить использование useCall. |
| `src/navigation/AppNavigator.tsx` | Обновить CallScreenRoute. |
| `src/lib/nativeVpn.ts` | Формировать полный конфиг с PrivateKey. |
| `src/lib/vpnConfig.ts` | NEW. Хранение/получение приватного ключа + сборка конфига. |
| `src/components/VpnCard.tsx` | Использовать vpnConfig и nativeVpn. |
| `src/lib/pushNotifications.ts` | NEW. Регистрация FCM токена, слушатели. |
| `src/api/push.ts` | NEW. API для регистрации токена. |
| `src/App.tsx` | Инициализация push при старте. |
| `src/i18n/locales/*.json` | Новые ключи. |

---

## Task 1: Fix incoming call reject

**Files:**
- Modify: `apps/mobile/src/hooks/useCall.ts`
- Modify: `apps/mobile/src/context/CallContext.tsx`
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Rewrite useCall to accept callId in methods**

Replace `apps/mobile/src/hooks/useCall.ts`:

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

export interface Call {
  callId: string;
  remoteUserId: string;
  state: CallState;
}

export function useCall() {
  const socket = useSocket();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);

  const closeCall = useCallback((callId: string) => {
    if (activeCall?.callId !== callId) return;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setActiveCall((prev) => (prev?.callId === callId ? null : prev));
  }, [activeCall]);

  const startCall = useCallback(async (toUserId: string): Promise<Call> => {
    if (!socket) throw new Error('Socket not connected');
    const id = crypto.randomUUID();
    setActiveCall({ callId: id, remoteUserId: toUserId, state: 'dialing' });

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

    return { callId: id, remoteUserId: toUserId, state: 'dialing' };
  }, [socket]);

  const acceptCall = useCallback(async (incomingCallId: string, fromUserId: string, offerSdp: string): Promise<Call> => {
    if (!socket) throw new Error('Socket not connected');
    setActiveCall({ callId: incomingCallId, remoteUserId: fromUserId, state: 'incoming' });

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
    setActiveCall({ callId: incomingCallId, remoteUserId: fromUserId, state: 'connected' });

    return { callId: incomingCallId, remoteUserId: fromUserId, state: 'connected' };
  }, [socket]);

  const rejectCall = useCallback((callId: string) => {
    if (!socket) return;
    socket.emit('call:reject', { callId });
    closeCall(callId);
  }, [socket, closeCall]);

  const hangUp = useCallback((callId: string) => {
    if (!socket) return;
    socket.emit('call:hangup', { callId });
    closeCall(callId);
  }, [socket, closeCall]);

  useEffect(() => {
    if (!socket || !activeCall) return;
    const callId = activeCall.callId;

    const onAnswer = async ({ callId: id, sdp }: { callId: string; sdp: string }) => {
      if (id !== callId || !pcRef.current) return;
      await setRemoteDescription(pcRef.current, new RTCSessionDescription({ type: 'answer', sdp }));
      setActiveCall((prev) => (prev?.callId === callId ? { ...prev, state: 'connected' } : prev));
    };

    const onIceCandidate = async ({ callId: id, candidate }: { callId: string; candidate: any }) => {
      if (id !== callId || !pcRef.current) return;
      await addIceCandidate(pcRef.current, candidate);
    };

    const onHangUp = ({ callId: id }: { callId: string }) => {
      if (id !== callId) return;
      closeCall(callId);
    };

    const onReject = ({ callId: id }: { callId: string }) => {
      if (id !== callId) return;
      setActiveCall((prev) => (prev?.callId === callId ? { ...prev, state: 'rejected' } : prev));
      closeCall(callId);
    };

    const onTimeout = ({ callId: id }: { callId: string }) => {
      if (id !== callId) return;
      setActiveCall((prev) => (prev?.callId === callId ? { ...prev, state: 'timeout' } : prev));
      closeCall(callId);
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
  }, [socket, activeCall, closeCall]);

  return {
    activeCall,
    startCall,
    acceptCall,
    rejectCall,
    hangUp,
    localStream: localStreamRef.current,
    remoteStream: remoteStreamRef.current,
  };
}
```

- [ ] **Step 2: Update CallContext to use new API**

Replace `apps/mobile/src/context/CallContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSocket } from './SocketContext';
import { useCall } from '../hooks/useCall';
import { IncomingCallModal } from '../components/IncomingCallModal';
import { useAuthStore } from '../stores/authStore';
import type { MainStackParamList } from '../navigation/types';

interface IncomingCall {
  callId: string;
  fromUserId: string;
  displayName: string;
  sdp: string;
}

const CallContext = createContext<ReturnType<typeof useCall> | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const socket = useSocket();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuthStore();
  const call = useCall();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onIncoming = ({ callId, fromUserId, sdp }: any) => {
      if (call.activeCall) {
        socket.emit('call:busy', { callId, toUserId: fromUserId });
        return;
      }
      const contactName = user?.tenants
        .flatMap((m) => (m.tenant as any).members || [])
        .find((u: any) => u.id === fromUserId)?.displayName || fromUserId;
      setIncoming({ callId, fromUserId, displayName: contactName, sdp });
    };
    socket.on('call:incoming', onIncoming);
    return () => { socket.off('call:incoming', onIncoming); };
  }, [socket, user, call.activeCall]);

  const handleAccept = useCallback(async () => {
    if (!incoming) return;
    await call.acceptCall(incoming.callId, incoming.fromUserId, incoming.sdp);
    setIncoming(null);
    navigation.navigate('Call', { userId: incoming.fromUserId, displayName: incoming.displayName });
  }, [incoming, call, navigation]);

  const handleDecline = useCallback(() => {
    if (!incoming) return;
    call.rejectCall(incoming.callId);
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

- [ ] **Step 3: Update CallScreenRoute**

Modify `apps/mobile/src/navigation/AppNavigator.tsx` `CallScreenRoute`:

```tsx
function CallScreenRoute({ route, navigation }: any) {
  const { displayName, userId } = route.params;
  const { activeCall, startCall, hangUp } = useCallContext();

  useEffect(() => {
    if (!activeCall) {
      startCall(userId);
    }
  }, [activeCall, startCall, userId]);

  const subtitle =
    activeCall?.state === 'dialing' ? 'Calling...' :
    activeCall?.state === 'connected' ? 'Call in progress' :
    'Call ended';

  return (
    <CallScreen
      title={displayName}
      subtitle={subtitle}
      onHangUp={() => { hangUp(activeCall?.callId || ''); navigation.goBack(); }}
    />
  );
}
```

- [ ] **Step 4: Run lint and commit**

Run: `cd apps/mobile && pnpm lint`
Expected: PASS.

```bash
git add apps/mobile/src/hooks/useCall.ts apps/mobile/src/context/CallContext.tsx apps/mobile/src/navigation/AppNavigator.tsx
git commit -m "fix(mobile): pass callId explicitly, fix incoming call reject"
```

---

## Task 2: Store VPN private key and build full config

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`
- Create: `apps/mobile/src/lib/vpnConfig.ts`
- Modify: `apps/mobile/src/components/VpnCard.tsx`

- [ ] **Step 1: Install expo-secure-store**

Run:

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm add expo-secure-store
```

- [ ] **Step 2: Add secure-store plugin**

Ensure `app.json` plugins include `expo-secure-store`:

```json
"plugins": [
  "expo-secure-store",
  ["react-native-wireguard-vpn", {}]
]
```

- [ ] **Step 3: Create vpnConfig helper**

Create `apps/mobile/src/lib/vpnConfig.ts`:

```ts
import * as SecureStore from 'expo-secure-store';
import { VpnConfig } from '../api/vpn';

const VPN_PRIVATE_KEY_PREFIX = 'vpn_private_key_';

export async function saveVpnPrivateKey(peerId: string, privateKey: string): Promise<void> {
  await SecureStore.setItemAsync(`${VPN_PRIVATE_KEY_PREFIX}${peerId}`, privateKey);
}

export async function getVpnPrivateKey(peerId: string): Promise<string | null> {
  return SecureStore.getItemAsync(`${VPN_PRIVATE_KEY_PREFIX}${peerId}`);
}

export async function deleteVpnPrivateKey(peerId: string): Promise<void> {
  await SecureStore.deleteItemAsync(`${VPN_PRIVATE_KEY_PREFIX}${peerId}`);
}

export function buildWireGuardConfig(config: VpnConfig, privateKey: string): string {
  return `[Interface]
PrivateKey = ${privateKey}
Address = ${config.address}
DNS = ${config.dns}

[Peer]
PublicKey = ${config.publicKey}
AllowedIPs = ${config.allowedIps}
Endpoint = ${config.endpoint}
PersistentKeepalive = 25
`;
}
```

- [ ] **Step 4: Update VpnCard**

Modify `apps/mobile/src/components/VpnCard.tsx`:

1. Add import:

```tsx
import { saveVpnPrivateKey, deleteVpnPrivateKey, buildWireGuardConfig } from '../lib/vpnConfig';
```

2. In `handleCreate`, on success save private key:

```tsx
const keys = generateKeyPair();
create.mutate(keys.publicKey, {
  onSuccess: async (config) => {
    await saveVpnPrivateKey(config.id, keys.privateKey);
  },
  onError: (err: any) => {
    Alert.alert(t('vpnError'), err?.response?.data?.error || err.message);
  },
});
```

3. Update connect button:

```tsx
<Button
  title={connected ? t('disconnectVpn') : t('connectVpn')}
  onPress={async () => {
    try {
      if (connected) {
        await disconnectVpn();
        setConnected(false);
      } else if (config) {
        const privateKey = await getVpnPrivateKey(config.id);
        if (!privateKey) {
          Alert.alert(t('vpnError'), 'Private key not found. Delete and recreate config.');
          return;
        }
        const fullConfig = buildWireGuardConfig(config, privateKey);
        await connectVpn(fullConfig, 'Pulse VPN');
        setConnected(true);
      }
    } catch (err: any) {
      Alert.alert(t('vpnError'), err.message);
    }
  }}
/>
```

4. Update handleDelete:

```tsx
const handleDelete = () => {
  Alert.alert(t('deleteVpnConfirm'), t('deleteVpnSubtitle'), [
    { text: t('cancel', 'Cancel'), style: 'cancel' },
    {
      text: t('delete', 'Delete'),
      style: 'destructive',
      onPress: async () => {
        if (config) {
          await deleteVpnPrivateKey(config.id);
        }
        remove.mutate();
      },
    },
  ]);
};
```

- [ ] **Step 5: Run lint and commit**

Run: `cd apps/mobile && pnpm lint`
Expected: PASS.

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/src/lib/vpnConfig.ts apps/mobile/src/components/VpnCard.tsx
git commit -m "feat(mobile): store vpn private key in SecureStore and build full config"
```

---

## Task 3: Backend push token storage

**Files:**
- Modify: `services/api/prisma/schema.prisma`
- Create: `services/api/src/routes/push.ts`
- Modify: `services/api/src/routes/index.ts`
- Modify: `services/api/src/config.ts`
- Test: `services/api/tests/push.test.ts`

- [ ] **Step 1: Add PushToken model**

Modify `services/api/prisma/schema.prisma`:

```prisma
model PushToken {
  id        String   @id @default(uuid())
  token     String   @unique
  platform  String   // android | ios
  userId    String
  tenantId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tenantId])
}
```

Add relation to User model:

```prisma
model User {
  ...
  pushTokens PushToken[]
}
```

Run:

```bash
cd /home/shugar/dev/pulse-chat/services/api && pnpm exec prisma db push --accept-data-loss
```

- [ ] **Step 2: Add push routes**

Create `services/api/src/routes/push.ts`:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseOrThrow } from '../lib/validation.js';
import { prisma } from '../lib/prisma.js';

export const pushRouter: Router = Router();
pushRouter.use(requireAuth);

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['android', 'ios']),
});

pushRouter.post('/register', async (req: AuthRequest, res) => {
  const { token, platform } = parseOrThrow(registerSchema, req.body);
  await prisma.pushToken.upsert({
    where: { token },
    create: {
      token,
      platform,
      userId: req.user!.userId,
      tenantId: req.tenantId!,
    },
    update: {
      userId: req.user!.userId,
      tenantId: req.tenantId!,
      platform,
    },
  });
  res.json({ ok: true });
});

pushRouter.delete('/unregister', async (req: AuthRequest, res) => {
  const { token } = parseOrThrow(z.object({ token: z.string().min(1) }), req.body);
  await prisma.pushToken.deleteMany({
    where: { token, userId: req.user!.userId },
  });
  res.json({ ok: true });
});
```

- [ ] **Step 3: Mount and config**

Modify `services/api/src/routes/index.ts`:

```ts
import { pushRouter } from './push.js';
routes.use('/push', pushRouter);
```

Modify `services/api/src/config.ts`:

Add to envSchema:

```ts
FIREBASE_SERVICE_ACCOUNT: z.string().min(1).default(''),
```

Add to exported config:

```ts
firebaseServiceAccount: env.FIREBASE_SERVICE_ACCOUNT,
```

- [ ] **Step 4: Add push tests**

Create `services/api/tests/push.test.ts`:

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
  await prisma.pushToken.deleteMany();
  await prisma.vpnPeer.deleteMany();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Push tokens', () => {
  it('registers a push token', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .post('/api/push/register')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ token: 'fcm-token-123', platform: 'android' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const stored = await prisma.pushToken.findUnique({ where: { token: 'fcm-token-123' } });
    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(alice.user.id);
  });
});
```

Run: `cd services/api && pnpm test -- --testPathPattern=push.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/prisma/schema.prisma services/api/src/routes/push.ts services/api/src/routes/index.ts services/api/src/config.ts services/api/tests/push.test.ts
git commit -m "feat(api): push token registration endpoint"
```

---

## Task 4: Send push on incoming call

**Files:**
- Modify: `services/api/package.json`
- Create: `services/api/src/lib/push.ts`
- Modify: `services/api/src/lib/socket.ts`
- Modify: `services/api/.env.example`
- Modify: `.env.example`

- [ ] **Step 1: Install firebase-admin**

Run:

```bash
cd /home/shugar/dev/pulse-chat/services/api && pnpm add firebase-admin
```

- [ ] **Step 2: Create push sender**

Create `services/api/src/lib/push.ts`:

```ts
import admin from 'firebase-admin';
import { config } from '../config.js';
import { prisma } from './prisma.js';

let initialized = false;

function getApp() {
  if (!config.firebaseServiceAccount) return null;
  if (!initialized) {
    const serviceAccount = JSON.parse(config.firebaseServiceAccount);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
  }
  return admin;
}

export async function sendIncomingCallPush(userId: string, callerName: string) {
  const app = getApp();
  if (!app) return;

  const tokens = await prisma.pushToken.findMany({
    where: { userId, platform: 'android' },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  const messaging = app.messaging();
  const message = {
    data: {
      type: 'incoming_call',
      callerName,
    },
    tokens: tokens.map((t) => t.token),
  };

  try {
    await messaging.sendEachForMulticast(message);
  } catch (err) {
    console.error('Failed to send push', err);
  }
}
```

- [ ] **Step 3: Trigger push from call:offer**

Modify `services/api/src/lib/socket.ts` `call:offer` handler:

After `io.to(\`user:${toUserId}\`).emit('call:incoming', ...)` add:

```ts
import { sendIncomingCallPush } from './push.js';

const socketCount = io.sockets.adapter.rooms.get(`user:${toUserId}`)?.size || 0;
if (socketCount === 0) {
  sendIncomingCallPush(toUserId, 'Incoming call').catch(() => {});
}
```

- [ ] **Step 4: Update env examples**

Add to `services/api/.env.example` and `.env.example`:

```bash
FIREBASE_SERVICE_ACCOUNT=
```

- [ ] **Step 5: Run tests and commit**

Run: `cd services/api && pnpm test`
Expected: PASS.

```bash
git add services/api/package.json services/api/src/lib/push.ts services/api/src/lib/socket.ts services/api/.env.example .env.example
git commit -m "feat(api): send FCM push on incoming call"
```

---

## Task 5: Mobile push registration and handling

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`
- Create: `apps/mobile/src/lib/pushNotifications.ts`
- Create: `apps/mobile/src/api/push.ts`
- Modify: `apps/mobile/src/App.tsx`
- Modify: `apps/mobile/src/i18n/locales/*.json`

- [ ] **Step 1: Install expo-notifications**

Run:

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm add expo-notifications
```

- [ ] **Step 2: Add plugin and Android permissions**

Modify `apps/mobile/app.json`:

```json
{
  "expo": {
    ...
    "android": {
      "package": "chat.pulse.mobile",
      "permissions": [
        "android.permission.RECORD_AUDIO",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.POST_NOTIFICATIONS"
      ],
      ...
    },
    "plugins": [
      "expo-secure-store",
      ["react-native-wireguard-vpn", {}],
      [
        "expo-notifications",
        { "icon": "./assets/notification-icon.png" }
      ]
    ]
  }
}
```

Use existing app icon if available, or remove icon property.

- [ ] **Step 3: Create push API module**

Create `apps/mobile/src/api/push.ts`:

```ts
import { api } from './client';

export function registerPushToken(token: string, platform: 'android' | 'ios') {
  return api.post('/push/register', { token, platform }).then((r) => r.data);
}

export function unregisterPushToken(token: string) {
  return api.delete('/push/unregister', { data: { token } }).then((r) => r.data);
}
```

- [ ] **Step 4: Create push notifications helper**

Create `apps/mobile/src/lib/pushNotifications.ts`:

```ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken } from '../api/push';

export async function initPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;
  await registerPushToken(token, Platform.OS === 'android' ? 'android' : 'ios');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  return token;
}
```

Note: For direct FCM tokens instead of Expo tokens, use `getDevicePushTokenAsync` and configure FCM in EAS. For this plan we use Expo push service as intermediate; backend must support Expo push tokens or FCM. To keep backend simple with `firebase-admin`, use FCM tokens. Adjust mobile to use `getDevicePushTokenAsync`.

If using FCM tokens, change:

```ts
import { getDevicePushTokenAsync } from 'expo-notifications';
const tokenData = await getDevicePushTokenAsync();
const token = tokenData.data;
```

Use whichever token type the backend expects. This plan assumes FCM tokens via `getDevicePushTokenAsync` on Android.

- [ ] **Step 5: Initialize push in App**

Modify `apps/mobile/src/App.tsx`:

```tsx
import { initPushNotifications } from './lib/pushNotifications';

export default function App() {
  ...
  useEffect(() => {
    initPushNotifications().catch(() => {});
  }, []);
  ...
}
```

- [ ] **Step 6: Add i18n keys**

Add `noPrivateKey`, `incomingCallNotification` to both locales.

- [ ] **Step 7: Run lint and commit**

Run: `cd apps/mobile && pnpm lint`
Expected: PASS.

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/src/lib/pushNotifications.ts apps/mobile/src/api/push.ts apps/mobile/src/App.tsx apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/ru.json
git commit -m "feat(mobile): FCM push token registration and notification handling"
```

---

## Task 6: Final verification

**Files:**
- All

- [ ] **Step 1: Run tests and lint**

```bash
cd /home/shugar/dev/pulse-chat && pnpm test
cd apps/mobile && pnpm lint
cd services/api && pnpm lint
```

Expected: all PASS.

- [ ] **Step 2: Commit lockfile if changed**

```bash
git add pnpm-lock.yaml 2>/dev/null || true
git diff --cached --quiet || git commit -m "chore: update lockfile"
```

- [ ] **Step 3: Report DONE**

Include final status and any manual steps required (FCM service account JSON, EAS FCM config).

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Fix reject | Task 1 |
| Auto VPN tunnel | Task 2 |
| Push token storage | Task 3 |
| Send push on call | Task 4 |
| Mobile push registration | Task 5 |
| Verification | Task 6 |

### Placeholder scan

- No TBD/TODO.
- All code blocks concrete.

### Type consistency

- `useCall` returns `activeCall` instead of separate state vars.
- `VpnConfig` type reused from `apps/mobile/src/api/vpn.ts`.
- Push token platform enum matches frontend values.

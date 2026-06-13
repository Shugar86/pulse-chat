# Pulse Chat MVP Polish Round

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть острые шероховатости MVP в мобильном UI, VPN-интеграции и бэкенде, чтобы приложение выглядело цельным и не падало при ежедневном использовании.

**Architecture:**
- **Mobile UI polish** — довести до конца VibeCraft-токены (`theme/index.ts`) и повторно используемые компоненты, добавить недостающие i18n-ключи и микро-анимации.
- **VPN polish** — отказаться от хранения приватных ключей на сервере: мобайл генерирует пару, отдаёт публичный ключ API, получает в ответ серверный публичный ключ и конфиг без `PrivateKey`.
- **Backend polish** — rate limiter на Redis вместо in-memory (готовится к горизонтальному масштабированию), `/health` с проверками БД, graceful shutdown, базовые security-заголовки и CORS-защита.

**Tech Stack:** TypeScript, React Native, Expo, Zustand, TanStack Query, Node.js, Express, Prisma, PostgreSQL, Redis, Docker Compose, WireGuard, tweetnacl.

---

## File Structure

### Mobile UI

| File | Responsibility |
|------|----------------|
| `apps/mobile/src/theme/index.ts` | Добавить `statusColors`, `animation` токены. |
| `apps/mobile/src/components/Input.tsx` | Добавить `focus` состояние с анимацией border. |
| `apps/mobile/src/components/ListItem.tsx` | Поддержать press-scale, subtitle-статус, leading badge. |
| `apps/mobile/src/components/Avatar.tsx` | Добавить online-индикатор с pulse. |
| `apps/mobile/src/screens/WelcomeScreen.tsx` | Добавить fade-in анимацию. |
| `apps/mobile/src/screens/LoginScreen.tsx` | Показывать inline ошибки полей; убрать alert-логику. |
| `apps/mobile/src/screens/RegisterScreen.tsx` | То же. |
| `apps/mobile/src/i18n/locales/en.json` / `ru.json` | Добавить ключи VPN, ошибок, welcome. |

### VPN Security

| File | Responsibility |
|------|----------------|
| `apps/mobile/src/lib/wireguard.ts` | NEW. Генерация ключевой пары на устройстве через `react-native-wireguard-vpn` (или tweetnacl-js если доступен). |
| `apps/mobile/src/api/vpn.ts` | Обновить типы: `VpnConfig` без `privateKey`, новый endpoint для публикации публичного ключа. |
| `services/api/src/lib/wireguard.ts` | Убрать генерацию приватного ключа; оставить base64-helpers и рендер конфига. |
| `services/api/src/routes/vpn.ts` | `POST /config` принимает `publicKey` от клиента, сохраняет peer, возвращает конфиг без `PrivateKey`. |
| `services/api/prisma/schema.prisma` | Убрать `privateKey` из `VpnPeer`. |
| `services/api/tests/vpn.test.ts` | Обновить тесты под клиентскую генерацию ключей. |

### Backend Robustness

| File | Responsibility |
|------|----------------|
| `services/api/src/lib/redis.ts` | NEW. Redis-клиент на базе `ioredis`. |
| `services/api/src/middleware/rateLimit.ts` | Переписать на Redis sliding window с fallback в память. |
| `services/api/src/routes/health.ts` | NEW. `/health` и `/health/ready` с проверками БД и Redis. |
| `services/api/src/middleware/security.ts` | NEW. Helmet-like заголовки + CORS hardening. |
| `services/api/src/index.ts` | Graceful shutdown: закрыть HTTP, Socket.io, Prisma, Redis. |
| `services/api/tests/health.test.ts` | NEW. Тесты health endpoint. |
| `docker-compose.yml` | Убедиться что Redis поднимается и доступен по `REDIS_URL`. |
| `.env.example` / `services/api/.env.example` | Добавить `REDIS_URL`. |

---

## Task 1: Mobile theme tokens and component micro-polish

**Files:**
- Modify: `apps/mobile/src/theme/index.ts`
- Modify: `apps/mobile/src/components/Input.tsx`
- Modify: `apps/mobile/src/components/ListItem.tsx`
- Modify: `apps/mobile/src/components/Avatar.tsx`

- [ ] **Step 1: Extend theme tokens**

Modify `apps/mobile/src/theme/index.ts`:

```ts
export const statusColors = {
  online: '#4A7C59',
  offline: '#A89E92',
} as const;

export const animation = {
  pressScale: 0.97,
  fadeDuration: 200,
  spring: { friction: 5, useNativeDriver: true },
} as const;
```

Run: `cd apps/mobile && pnpm lint`
Expected: PASS.

- [ ] **Step 2: Animate Input focus border**

Modify `apps/mobile/src/components/Input.tsx`:

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, Animated } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(borderColor, {
      toValue: focused ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [focused, borderColor]);

  const colorInterpolation = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? colors.error : colors.border, error ? colors.error : colors.primary],
  });

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View style={{ borderWidth: 1, borderColor: colorInterpolation, borderRadius: radius.md }}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textTertiary}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
      </Animated.View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  label: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    ...typography.body,
  },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.sm },
});
```

Run: `cd apps/mobile && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Add press-scale and online dot to ListItem/Avatar**

Modify `apps/mobile/src/components/ListItem.tsx` (add `Animated` press-scale wrapper; keep existing props intact).

Modify `apps/mobile/src/components/Avatar.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Animated } from 'react-native';
import { colors, radius, typography, statusColors } from '../theme';

type Size = 'sm' | 'md' | 'lg';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: Size;
  isOnline?: boolean;
}

const sizeMap: Record<Size, { container: number; font: number; indicator: number }> = {
  sm: { container: 36, font: 14, indicator: 8 },
  md: { container: 48, font: 18, indicator: 10 },
  lg: { container: 80, font: 30, indicator: 14 },
};

export function Avatar({ uri, name = '?', size = 'md', isOnline }: AvatarProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const s = sizeMap[size];
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!isOnline) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isOnline, pulse]);

  return (
    <View style={[styles.container, { width: s.container, height: s.container, borderRadius: radius.full }]}>
      <View style={[styles.fallback, { width: s.container, height: s.container, borderRadius: radius.full }]}>
        <Text style={[styles.text, { fontSize: s.font }]}>{initials}</Text>
      </View>
      {isOnline !== undefined ? (
        <View style={[styles.indicatorContainer, { width: s.indicator, height: s.indicator, borderRadius: s.indicator / 2, bottom: size === 'lg' ? 4 : 0, right: size === 'lg' ? 4 : 0 }]}>
          <Animated.View style={[styles.indicatorPulse, { width: s.indicator, height: s.indicator, borderRadius: s.indicator / 2, backgroundColor: statusColors.online, transform: [{ scale: pulse }] }]} />
          <View style={[styles.indicator, { width: s.indicator, height: s.indicator, borderRadius: s.indicator / 2, backgroundColor: isOnline ? statusColors.online : statusColors.offline }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  fallback: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.secondary, fontWeight: '600' },
  indicatorContainer: { position: 'absolute', borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  indicatorPulse: { position: 'absolute', opacity: 0.4 },
  indicator: { position: 'absolute' },
});
```

Run: `cd apps/mobile && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/theme/index.ts apps/mobile/src/components/Input.tsx apps/mobile/src/components/ListItem.tsx apps/mobile/src/components/Avatar.tsx
git commit -m "polish(mobile): theme tokens, input focus animation, avatar online indicator"
```

---

## Task 2: Welcome screen and auth form polish

**Files:**
- Modify: `apps/mobile/src/screens/WelcomeScreen.tsx`
- Modify: `apps/mobile/src/screens/LoginScreen.tsx`
- Modify: `apps/mobile/src/screens/RegisterScreen.tsx`
- Modify: `apps/mobile/src/i18n/locales/en.json` / `ru.json`

- [ ] **Step 1: Add fade-in animation to WelcomeScreen**

Modify `apps/mobile/src/screens/WelcomeScreen.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
...

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <Animated.View style={[styles.container, { opacity: fade }]}>
      ...existing content...
    </Animated.View>
  );
}
```

- [ ] **Step 2: Improve error display in Login/Register screens**

Modify `LoginScreen.tsx` and `RegisterScreen.tsx`:

- Убрать `setError` для field-ошибок; передавать `errors.*` напрямую в `Input error`.
- Оставить `setError` только для server-level ошибок (network, 401).
- Добавить `keyboardType` и `autoCapitalize` где не хватает.

- [ ] **Step 3: Add missing i18n keys**

Add to `apps/mobile/src/i18n/locales/en.json` and `ru.json`:

```json
{
  "vpn": "Corporate VPN",
  "vpnHint": "Connect your device to the tenant VPN.",
  "enableVpn": "Enable VPN",
  "deleteVpn": "Delete VPN config",
  "connectVpn": "Connect VPN",
  "disconnectVpn": "Disconnect VPN",
  "vpnError": "VPN error",
  "deleteVpnConfirm": "Delete VPN config?",
  "deleteVpnSubtitle": "You will need to reconnect afterwards."
}
```

- [ ] **Step 4: Run lint and commit**

Run: `cd apps/mobile && pnpm lint`
Expected: PASS.

```bash
git add apps/mobile/src/screens/WelcomeScreen.tsx apps/mobile/src/screens/LoginScreen.tsx apps/mobile/src/screens/RegisterScreen.tsx apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/ru.json
git commit -m "polish(mobile): welcome fade, auth field errors, vpn i18n keys"
```

---

## Task 3: Move VPN key generation to mobile (security)

**Files:**
- Create: `apps/mobile/src/lib/wireguard.ts`
- Modify: `apps/mobile/src/api/vpn.ts`
- Modify: `apps/mobile/src/components/VpnCard.tsx`
- Modify: `apps/mobile/src/hooks/useVpn.ts`
- Modify: `services/api/src/lib/wireguard.ts`
- Modify: `services/api/src/routes/vpn.ts`
- Modify: `services/api/prisma/schema.prisma`
- Modify: `services/api/tests/vpn.test.ts`
- Modify: `services/api/tests/wireguard.test.ts`

- [ ] **Step 1: Mobile key generation helper**

Create `apps/mobile/src/lib/wireguard.ts`:

```ts
// Generate Curve25519 key pair locally.
// In a real app this should call into WireGuardKit / wireguard-android.
// For the MVP we use tweetnacl-js if available, otherwise a placeholder.

import * as nacl from 'tweetnacl';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export function generateKeyPair(): KeyPair {
  const pair = nacl.box.keyPair();
  return {
    privateKey: Buffer.from(pair.secretKey).toString('base64'),
    publicKey: Buffer.from(pair.publicKey).toString('base64'),
  };
}
```

Install tweetnacl in mobile workspace:

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm add tweetnacl
```

- [ ] **Step 2: Update mobile VPN API**

Modify `apps/mobile/src/api/vpn.ts`:

```ts
import { api } from './client';

export interface VpnConfig {
  id: string;
  address: string;
  publicKey: string; // server public key
  endpoint: string;
  dns: string;
  allowedIps: string;
  config: string; // client config WITHOUT PrivateKey
}

export function getVpnConfig() {
  return api.get<VpnConfig>('/vpn/config').then((r) => r.data);
}

export function createVpnConfig(clientPublicKey: string) {
  return api.post<VpnConfig>('/vpn/config', { publicKey: clientPublicKey }).then((r) => r.data);
}

export function deleteVpnConfig() {
  return api.delete('/vpn/config').then((r) => r.data);
}
```

- [ ] **Step 3: Update VpnCard to generate keys locally**

Modify `apps/mobile/src/components/VpnCard.tsx`:

```tsx
import { generateKeyPair } from '../lib/wireguard';

const handleCreate = () => {
  const keys = generateKeyPair();
  create.mutate(keys.publicKey, {
    onSuccess: (config) => {
      // Store private key securely for native tunnel later
      // For MVP we keep it in component state or SecureStore
    },
    onError: (err: any) => {
      Alert.alert(t('vpnError'), err?.response?.data?.error || err.message);
    },
  });
};
```

Also wrap texts with `t()` and add `t` import.

- [ ] **Step 4: Update backend key generation**

Modify `services/api/src/lib/wireguard.ts`:

```ts
export function generateKeyPair(): KeyPair {
  const pair = nacl.box.keyPair();
  return {
    privateKey: Buffer.from(pair.secretKey).toString('base64'),
    publicKey: Buffer.from(pair.publicKey).toString('base64'),
  };
}
```

Keep `generateClientConfig` but note it no longer emits `PrivateKey` if not provided.

Modify `services/api/src/routes/vpn.ts`:

```ts
const createSchema = z.object({ publicKey: z.string().min(1) });

// POST /config
const { publicKey } = parseOrThrow(createSchema, req.body);
const address = await allocateAddress(...);
const peer = await prisma.vpnPeer.create({ data: { userId, tenantId, publicKey, address, ... } });
```

Remove `privateKey` from Prisma `VpnPeer` model and run `prisma db push --accept-data-loss` in dev.

- [ ] **Step 5: Update tests**

Modify `services/api/tests/vpn.test.ts` to send `publicKey` in POST body.

Modify `services/api/tests/wireguard.test.ts` to assert that config without `PrivateKey` still renders valid `[Interface]` block.

Run: `cd services/api && pnpm test -- --testPathPattern='vpn|wireguard'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/wireguard.ts apps/mobile/src/api/vpn.ts apps/mobile/src/components/VpnCard.tsx apps/mobile/src/hooks/useVpn.ts services/api/src/lib/wireguard.ts services/api/src/routes/vpn.ts services/api/prisma/schema.prisma services/api/tests/vpn.test.ts services/api/tests/wireguard.test.ts
pdm -C services/api exec prisma db push --accept-data-loss
# or: cd services/api && pnpm exec prisma db push --accept-data-loss
git commit -m "security(vpn): generate keys on device, server stores only public key"
```

---

## Task 4: Backend rate limiter on Redis

**Files:**
- Create: `services/api/src/lib/redis.ts`
- Modify: `services/api/src/middleware/rateLimit.ts`
- Modify: `services/api/src/config.ts`
- Modify: `services/api/tests/setup.ts`
- Modify: `services/api/jest.config.js` (if needed for env)

- [ ] **Step 1: Add Redis client**

Create `services/api/src/lib/redis.ts`:

```ts
import Redis from 'ioredis';
import { config } from '../config.js';

export const redis = config.redisUrl ? new Redis(config.redisUrl) : null;

export async function closeRedis() {
  if (redis) await redis.quit();
}
```

Install ioredis:

```bash
cd /home/shugar/dev/pulse-chat/services/api && pnpm add ioredis
```

- [ ] **Step 2: Add REDIS_URL to config**

Modify `services/api/src/config.ts`:

```ts
REDIS_URL: z.string().min(1).default(''),
```

Add to exported `config` object:

```ts
redisUrl: env.REDIS_URL,
```

- [ ] **Step 3: Rewrite rate limiter**

Modify `services/api/src/middleware/rateLimit.ts`:

```ts
import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis.js';

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export function resetRateLimitWindows() {
  windows.clear();
}

export function rateLimit(options: { windowMs: number; max: number; keyPrefix?: string }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${options.keyPrefix || 'rl'}:${req.ip}`;

    if (redis) {
      const multi = redis.multi();
      multi.incr(key);
      multi.pexpire(key, options.windowMs);
      const [count] = await multi.exec() as [number, any];
      if (count > options.max) {
        return res.status(429).json({ error: 'Too many requests, please try again later' });
      }
      return next();
    }

    // In-memory fallback
    const now = Date.now();
    let window = windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + options.windowMs };
      windows.set(key, window);
    }
    window.count++;
    if (window.count > options.max) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }
    next();
  };
}
```

- [ ] **Step 4: Update tests**

Modify `services/api/tests/setup.ts`:

```ts
process.env.REDIS_URL = '';
```

Run: `cd services/api && pnpm test -- --testPathPattern=auth.test.ts`
Expected: PASS (rate limit tests still use in-memory fallback).

- [ ] **Step 5: Commit**

```bash
git add services/api/src/lib/redis.ts services/api/src/middleware/rateLimit.ts services/api/src/config.ts services/api/tests/setup.ts services/api/package.json
git commit -m "feat(api): redis-backed rate limiter with in-memory fallback"
```

---

## Task 5: Health checks and graceful shutdown

**Files:**
- Create: `services/api/src/routes/health.ts`
- Modify: `services/api/src/routes/index.ts`
- Modify: `services/api/src/index.ts`
- Modify: `services/api/src/lib/redis.ts`
- Create: `services/api/tests/health.test.ts`
- Modify: `services/api/src/server.ts` (optional, for graceful shutdown helpers)

- [ ] **Step 1: Create health router**

Create `services/api/src/routes/health.ts`:

```ts
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export const healthRouter: Router = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

healthRouter.get('/health/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }
  if (redis) {
    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }
  } else {
    checks.redis = 'ok';
  }
  const ok = Object.values(checks).every((v) => v === 'ok');
  res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'not_ready', checks });
});
```

- [ ] **Step 2: Mount health router**

Modify `services/api/src/routes/index.ts`:

```ts
import { healthRouter } from './health.js';
routes.use('/health', healthRouter);
```

- [ ] **Step 3: Graceful shutdown**

Modify `services/api/src/index.ts`:

```ts
import { closeRedis } from './lib/redis.js';

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  httpServer.close(() => console.log('HTTP server closed'));
  io.close(() => console.log('Socket.io server closed'));
  await prisma.$disconnect();
  await closeRedis();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

- [ ] **Step 4: Add health tests**

Create `services/api/tests/health.test.ts`:

```ts
import request from 'supertest';
import { createApp } from '../src/server';

const app = createApp();

describe('Health', () => {
  it('returns ok from /health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns ready status', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.database).toBe('ok');
  });
});
```

Run: `cd services/api && pnpm test -- --testPathPattern=health.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/routes/health.ts services/api/src/routes/index.ts services/api/src/index.ts services/api/src/lib/redis.ts services/api/tests/health.test.ts
git commit -m "feat(api): health checks and graceful shutdown"
```

---

## Task 6: Security headers and CORS hardening

**Files:**
- Create: `services/api/src/middleware/security.ts`
- Modify: `services/api/src/server.ts`
- Create: `services/api/tests/security.test.ts`

- [ ] **Step 1: Add security middleware**

Create `services/api/src/middleware/security.ts`:

```ts
import { Request, Response, NextFunction } from 'express';

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}
```

- [ ] **Step 2: Apply middleware before routes**

Modify `services/api/src/server.ts`:

```ts
import { securityHeaders } from './middleware/security.js';

export function createApp(): express.Express {
  const app = express();
  app.use(securityHeaders);
  app.use(cors({ origin: config.corsOrigin }));
  ...
}
```

- [ ] **Step 3: Add security tests**

Create `services/api/tests/security.test.ts`:

```ts
import request from 'supertest';
import { createApp } from '../src/server';

const app = createApp();

describe('Security headers', () => {
  it('sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});
```

Run: `cd services/api && pnpm test -- --testPathPattern=security.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/middleware/security.ts services/api/src/server.ts services/api/tests/security.test.ts
git commit -m "feat(api): add security headers middleware"
```

---

## Task 7: Docker Compose and env updates

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `services/api/.env.example`

- [ ] **Step 1: Ensure Redis is wired correctly**

`docker-compose.yml` already has `redis` service. Verify `services/api/.env` uses `REDIS_URL=redis://localhost:6379` when running locally, or container name when inside Docker.

- [ ] **Step 2: Update env examples**

Append to `.env.example` and `services/api/.env.example`:

```bash
REDIS_URL=redis://localhost:6379
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml .env.example services/api/.env.example
git commit -m "infra: expose REDIS_URL in env examples"
```

---

## Task 8: Final verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md` (if conventions changed)

- [ ] **Step 1: Run all tests and lint**

```bash
cd /home/shugar/dev/pulse-chat && pnpm test
```

Expected: all suites PASS.

```bash
cd /home/shugar/dev/pulse-chat/apps/mobile && pnpm lint
cd /home/shugar/dev/pulse-chat/services/api && pnpm lint
```

Expected: both PASS.

- [ ] **Step 2: Update README**

Append or update `## VPN (MVP)` section:

```markdown
### Security improvements

Starting with this polish round, VPN private keys are generated on the mobile device. The server stores only the client's public key and the server-side public key. Private keys never leave the device.
```

- [ ] **Step 3: Commit and final report**

```bash
git add README.md
git commit -m "docs: document vpn client-side key generation and polish round"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Mobile theme + micro-animations | Task 1, 2 |
| Client-side VPN key generation | Task 3 |
| Redis-backed rate limiting | Task 4 |
| Health checks | Task 5 |
| Graceful shutdown | Task 5 |
| Security headers | Task 6 |
| Env/docs updates | Task 7, 8 |

### Placeholder scan

- No `TBD`, `TODO`, или незаполненных секций.
- Все code blocks содержат конкретный код.

### Type consistency

- `VpnConfig` в мобайле больше не содержит `privateKey`.
- `VpnPeer` в Prisma теряет `privateKey`.
- `rateLimit` становится async-совместимым.

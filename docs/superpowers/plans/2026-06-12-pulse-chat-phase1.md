# pulse-chat Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working prototype of the core corporate messenger: registration/login, contacts, 1-to-1 and group chats, real-time text messages, read receipts, and ru/en localization.

**Architecture:** A pnpm-workspace monorepo with a Node.js/Express/Socket.io backend (`services/api`) and an Expo/React Native client (`apps/mobile`). PostgreSQL is the single source of truth, accessed through Prisma. The client talks to the backend via a typed REST API and WebSocket events.

**Tech Stack:** Node.js 22, Express 4, Socket.io 4, Prisma 5, PostgreSQL 16, Redis 7, JWT, Argon2, Zod, Jest, Supertest, Expo SDK 52, React Native 0.76, TypeScript 5, React Navigation 7, i18next, Zustand, TanStack Query 5.

---

## File map

```
pulse-chat/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── .env.example (exists)
├── packages/shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/index.ts
├── services/api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   ├── prisma/schema.prisma
│   ├── src/config.ts
│   ├── src/index.ts
│   ├── src/server.ts
│   ├── src/lib/prisma.ts
│   ├── src/lib/jwt.ts
│   ├── src/lib/socket.ts
│   ├── src/middleware/auth.ts
│   ├── src/middleware/error.ts
│   ├── src/routes/index.ts
│   ├── src/routes/auth.ts
│   ├── src/routes/users.ts
│   ├── src/routes/contacts.ts
│   ├── src/routes/chats.ts
│   └── tests/*.test.ts
└── apps/mobile/
    ├── package.json
    ├── tsconfig.json
    ├── app.json
    ├── babel.config.js
    ├── src/i18n/index.ts
    ├── src/i18n/locales/en.json
    ├── src/i18n/locales/ru.json
    ├── src/api/client.ts
    ├── src/api/auth.ts
    ├── src/api/chats.ts
    ├── src/api/contacts.ts
    ├── src/stores/authStore.ts
    ├── src/navigation/AppNavigator.tsx
    ├── src/navigation/AuthNavigator.tsx
    ├── src/navigation/MainNavigator.tsx
    ├── src/context/SocketContext.tsx
    ├── src/screens/WelcomeScreen.tsx
    ├── src/screens/LoginScreen.tsx
    ├── src/screens/RegisterScreen.tsx
    ├── src/screens/ChatsScreen.tsx
    ├── src/screens/ContactsScreen.tsx
    ├── src/screens/ProfileScreen.tsx
    ├── src/screens/ChatScreen.tsx
    └── src/App.tsx
```

---

### Task 1: Root monorepo setup

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `docker-compose.yml`
- Modify: `.gitignore` (append `services/api/dist`, `apps/mobile/dist`)

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "pulse-chat",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm -r dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'services/*'
  - 'packages/*'
```

- [ ] **Step 3: Write `docker-compose.yml`**

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: pulsechat
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
volumes:
  postgres_data:
```

- [ ] **Step 4: Append build dirs to `.gitignore`**

Add at the end:

```
services/api/dist
services/api/coverage
apps/mobile/dist
apps/mobile/coverage
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml docker-compose.yml .gitignore
git commit -m "chore: root monorepo setup with docker-compose"
```

---

### Task 2: Shared package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/package.json`**

```json
{
  "name": "@pulse-chat/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Write `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `packages/shared/src/index.ts`**

```typescript
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  preferredLanguage: 'ru' | 'en';
  createdAt: string;
  lastSeenAt: string;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  avatarUrl: string | null;
  updatedAt: string;
  members: ChatMember[];
}

export interface ChatMember {
  id: string;
  userId: string;
  role: 'member' | 'admin' | 'owner';
  user: User;
}

export interface Message {
  id: string;
  chatId: string;
  authorId: string;
  type: 'text' | 'audio' | 'call';
  content: string;
  createdAt: string;
  editedAt: string | null;
  author: User;
  readBy: { userId: string; readAt: string }[];
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "chore: add @pulse-chat/shared package with common types"
```

---

### Task 3: Backend project skeleton

**Files:**
- Create: `services/api/package.json`
- Create: `services/api/tsconfig.json`
- Create: `services/api/jest.config.js`
- Create: `services/api/src/config.ts`
- Create: `services/api/src/index.ts`
- Create: `services/api/src/server.ts`
- Create: `services/api/src/lib/prisma.ts`
- Create: `services/api/src/middleware/error.ts`
- Create: `services/api/prisma/schema.prisma`

- [ ] **Step 1: Write `services/api/package.json`**

```json
{
  "name": "@pulse-chat/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "test": "jest",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@pulse-chat/shared": "workspace:*",
    "@prisma/client": "^6.0.1",
    "argon2": "^0.41.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "socket.io": "^4.8.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.10.2",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "prisma": "^6.0.1",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Write `services/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Write `services/api/jest.config.js`**

```javascript
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

- [ ] **Step 4: Write `services/api/src/config.ts`**

```typescript
import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pulsechat?schema=public',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-min-32-characters-long',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-min-32-characters-long',
  accessTokenTtl: '15m',
  refreshTokenTtl: '7d',
};
```

- [ ] **Step 5: Write `services/api/src/lib/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 6: Write `services/api/src/middleware/error.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
```

- [ ] **Step 7: Write `services/api/src/server.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { errorHandler } from './middleware/error.js';
import { routes } from './routes/index.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}

export function createHttpServer(app: express.Express) {
  return createServer(app);
}

export function createIOServer(httpServer: ReturnType<typeof createServer>) {
  return new Server(httpServer, { cors: { origin: '*' } });
}
```

- [ ] **Step 8: Write `services/api/src/index.ts`**

```typescript
import { config } from './config.js';
import { createApp, createHttpServer, createIOServer } from './server.js';
import { setupSocketHandlers } from './lib/socket.js';

async function main() {
  const app = createApp();
  const httpServer = createHttpServer(app);
  const io = createIOServer(httpServer);
  setupSocketHandlers(io);

  httpServer.listen(config.port, () => {
    console.log(`API server listening on http://localhost:${config.port}`);
  });
}

main();
```

- [ ] **Step 9: Write placeholder `services/api/src/lib/socket.ts`**

```typescript
import { Server } from 'socket.io';

export function setupSocketHandlers(_io: Server) {
  // Handlers added in Task 7
}
```

- [ ] **Step 10: Write placeholder `services/api/src/routes/index.ts`**

```typescript
import { Router } from 'express';

export const routes = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));
```

- [ ] **Step 11: Write `services/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String   @id @default(uuid())
  email             String   @unique
  passwordHash      String
  displayName       String
  avatarUrl         String?
  preferredLanguage String   @default("ru")
  createdAt         DateTime @default(now())
  lastSeenAt        DateTime @default(now())

  ownedContacts    Contact[]    @relation("ContactOwner")
  targetOfContacts Contact[]    @relation("ContactTarget")
  memberships      ChatMember[]
  messages         Message[]
  readReceipts     ReadReceipt[]
}

model Contact {
  id        String        @id @default(uuid())
  ownerId   String
  targetId  String
  status    ContactStatus @default(pending)
  createdAt DateTime      @default(now())

  owner  User @relation("ContactOwner", fields: [ownerId], references: [id])
  target User @relation("ContactTarget", fields: [targetId], references: [id])

  @@unique([ownerId, targetId])
}

enum ContactStatus {
  pending
  accepted
  blocked
}

model Chat {
  id        String   @id @default(uuid())
  type      ChatType
  title     String?
  avatarUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members  ChatMember[]
  messages Message[]
}

enum ChatType {
  direct
  group
}

model ChatMember {
  id       String     @id @default(uuid())
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
  id        String      @id @default(uuid())
  chatId    String
  authorId  String
  type      MessageType @default(text)
  content   String
  createdAt DateTime    @default(now())
  editedAt  DateTime?

  chat         Chat          @relation(fields: [chatId], references: [id], onDelete: Cascade)
  author       User          @relation(fields: [authorId], references: [id])
  readReceipts ReadReceipt[]
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

- [ ] **Step 12: Install and generate Prisma client**

```bash
cd /home/shugar/dev/pulse-chat
pnpm install
cd services/api
pnpm exec prisma generate
```

- [ ] **Step 13: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api packages/shared pnpm-workspace.yaml package.json docker-compose.yml .gitignore
git commit -m "chore: backend skeleton with Prisma schema"
```

---

### Task 4: Auth module + tests

**Files:**
- Create: `services/api/src/lib/jwt.ts`
- Create: `services/api/src/middleware/auth.ts`
- Create: `services/api/src/routes/auth.ts`
- Modify: `services/api/src/routes/index.ts`
- Create: `services/api/tests/auth.test.ts`

- [ ] **Step 1: Write `services/api/src/lib/jwt.ts`**

```typescript
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export type TokenPayload = { userId: string; email: string };

export function signAccessToken(payload: TokenPayload) {
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.accessTokenTtl });
}

export function signRefreshToken(payload: TokenPayload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.refreshTokenTtl });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtAccessSecret) as TokenPayload;
}
```

- [ ] **Step 2: Write `services/api/src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../lib/jwt.js';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

- [ ] **Step 3: Write `services/api/src/routes/auth.ts`**

```typescript
import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signAccessToken, signRefreshToken } from '../lib/jwt.js';
import { ApiError } from '../middleware/error.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ApiError(409, 'Email already in use');
    const passwordHash = await argon2.hash(data.password);
    const user = await prisma.user.create({
      data: { email: data.email, passwordHash, displayName: data.displayName },
      select: { id: true, email: true, displayName: true, preferredLanguage: true },
    });
    const tokens = {
      accessToken: signAccessToken({ userId: user.id, email: user.email }),
      refreshToken: signRefreshToken({ userId: user.id, email: user.email }),
    };
    res.status(201).json({ user, tokens });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw new ApiError(401, 'Invalid credentials');
    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) throw new ApiError(401, 'Invalid credentials');
    const tokens = {
      accessToken: signAccessToken({ userId: user.id, email: user.email }),
      refreshToken: signRefreshToken({ userId: user.id, email: user.email }),
    };
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        preferredLanguage: user.preferredLanguage,
      },
      tokens,
    });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Modify `services/api/src/routes/index.ts`**

```typescript
import { Router } from 'express';
import { authRouter } from './auth.js';

export const routes = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));
routes.use('/auth', authRouter);
```

- [ ] **Step 5: Write failing test `services/api/tests/auth.test.ts`**

```typescript
import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';

const app = createApp();

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'secret123',
      displayName: 'Alice',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.tokens.accessToken).toBeDefined();
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'secret123',
      displayName: 'Alice',
    });
    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'secret123',
      displayName: 'Alice2',
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      password: 'secret123',
      displayName: 'Bob',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeDefined();
  });

  it('rejects invalid password', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      password: 'secret123',
      displayName: 'Bob',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'wrong',
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 6: Run migrations and tests**

Ensure Postgres is running:

```bash
cd /home/shugar/dev/pulse-chat
docker compose up -d
```

Then migrate:

```bash
cd services/api
cp ../../.env.example .env
# Edit .env DATABASE_URL if needed
pnpm exec prisma migrate dev --name init
```

Run tests:

```bash
pnpm test
```

Expected: all auth tests pass.

- [ ] **Step 7: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api
git commit -m "feat(api): auth module with register/login and tests"
```

---

### Task 5: Users & contacts module + tests

**Files:**
- Create: `services/api/src/routes/users.ts`
- Create: `services/api/src/routes/contacts.ts`
- Modify: `services/api/src/routes/index.ts`
- Create: `services/api/tests/contacts.test.ts`

- [ ] **Step 1: Write `services/api/src/routes/users.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const updateProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  preferredLanguage: z.enum(['ru', 'en']).optional(),
});

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.userId },
      select: { id: true, email: true, displayName: true, avatarUrl: true, preferredLanguage: true, lastSeenAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/me', async (req: AuthRequest, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: { id: true, email: true, displayName: true, avatarUrl: true, preferredLanguage: true, lastSeenAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/search', async (req: AuthRequest, res, next) => {
  try {
    const q = z.string().min(1).parse(req.query.q);
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
        id: { not: req.user!.userId },
      },
      take: 20,
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Write `services/api/src/routes/contacts.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const contactActionSchema = z.object({
  status: z.enum(['accepted', 'blocked', 'removed']),
});

export const contactsRouter = Router();

contactsRouter.use(requireAuth);

contactsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { ownerId: req.user!.userId, status: { not: 'removed' } },
      include: { target: { select: { id: true, email: true, displayName: true, avatarUrl: true, lastSeenAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(contacts);
  } catch (err) {
    next(err);
  }
});

contactsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { targetId } = z.object({ targetId: z.string().uuid() }).parse(req.body);
    if (targetId === req.user!.userId) throw new ApiError(400, 'Cannot add yourself');

    const existing = await prisma.contact.findUnique({
      where: { ownerId_targetId: { ownerId: req.user!.userId, targetId } },
    });
    if (existing) throw new ApiError(409, 'Contact request already exists');

    const contact = await prisma.contact.create({
      data: { ownerId: req.user!.userId, targetId },
      include: { target: { select: { id: true, email: true, displayName: true, avatarUrl: true, lastSeenAt: true } } },
    });
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

contactsRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { status } = contactActionSchema.parse(req.body);

    const contact = await prisma.contact.findFirst({
      where: { id, ownerId: req.user!.userId },
    });
    if (!contact) throw new ApiError(404, 'Contact not found');

    if (status === 'removed') {
      await prisma.contact.delete({ where: { id } });
      return res.status(204).send();
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: { status },
      include: { target: { select: { id: true, email: true, displayName: true, avatarUrl: true, lastSeenAt: true } } },
    });

    if (status === 'accepted') {
      const other = await prisma.contact.findUnique({
        where: { ownerId_targetId: { ownerId: contact.targetId, targetId: contact.ownerId } },
      });
      if (!other) {
        await prisma.contact.create({
          data: { ownerId: contact.targetId, targetId: contact.ownerId, status: 'accepted' },
        });
      } else if (other.status !== 'accepted') {
        await prisma.contact.update({ where: { id: other.id }, data: { status: 'accepted' } });
      }
      await ensureDirectChat(contact.ownerId, contact.targetId);
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

async function ensureDirectChat(userA: string, userB: string) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT c.id FROM "Chat" c
    JOIN "ChatMember" m1 ON c.id = m1."chatId" AND m1."userId" = ${userA}
    JOIN "ChatMember" m2 ON c.id = m2."chatId" AND m2."userId" = ${userB}
    WHERE c.type = 'direct'
    LIMIT 1
  `;
  if (existing.length > 0) {
    return prisma.chat.findUnique({ where: { id: existing[0].id } });
  }

  return prisma.chat.create({
    data: {
      type: 'direct',
      members: { create: [{ userId: userA }, { userId: userB }] },
    },
  });
}
```

- [ ] **Step 3: Modify `services/api/src/routes/index.ts`**

```typescript
import { Router } from 'express';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { contactsRouter } from './contacts.js';

export const routes = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));
routes.use('/auth', authRouter);
routes.use('/users', usersRouter);
routes.use('/contacts', contactsRouter);
```

- [ ] **Step 4: Write `services/api/tests/contacts.test.ts`**

```typescript
import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';

const app = createApp();

async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app).post('/api/auth/register').send({ email, password, displayName });
  return res.body.user as { id: string; email: string };
}

function tokenFor(userId: string, email: string) {
  return signAccessToken({ userId, email });
}

beforeEach(async () => {
  await prisma.contact.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Contacts', () => {
  it('creates a contact request and accepts it', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');

    const reqRes = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ targetId: bob.id });
    expect(reqRes.status).toBe(201);

    const acceptRes = await request(app)
      .patch(`/api/contacts/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ status: 'accepted' });
    expect(acceptRes.status).toBe(200);

    const chats = await prisma.chat.findMany({ include: { members: true } });
    expect(chats.length).toBe(1);
    expect(chats[0].members.map((m) => m.userId).sort()).toEqual([alice.id, bob.id].sort());
  });

  it('lists contacts', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ targetId: bob.id });

    const listRes = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd /home/shugar/dev/pulse-chat/services/api
pnpm test
```

Expected: auth and contacts tests pass.

- [ ] **Step 6: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api
git commit -m "feat(api): users and contacts endpoints with tests"
```

---

### Task 6: Chats & messages module + tests

**Files:**
- Create: `services/api/src/routes/chats.ts`
- Modify: `services/api/src/routes/index.ts`
- Create: `services/api/tests/chats.test.ts`

- [ ] **Step 1: Write `services/api/src/routes/chats.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const createGroupSchema = z.object({
  title: z.string().min(1),
  memberIds: z.array(z.string().uuid()).min(1),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const userSelect = { id: true, email: true, displayName: true, avatarUrl: true };

export const chatsRouter = Router();

chatsRouter.use(requireAuth);

chatsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const chats = await prisma.chat.findMany({
      where: { members: { some: { userId: req.user!.userId } } },
      include: {
        members: { include: { user: { select: userSelect } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { author: { select: userSelect } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(chats);
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { title, memberIds } = createGroupSchema.parse(req.body);
    const allMembers = Array.from(new Set([req.user!.userId, ...memberIds]));
    const chat = await prisma.chat.create({
      data: {
        type: 'group',
        title,
        members: { create: allMembers.map((userId, idx) => ({ userId, role: idx === 0 ? 'owner' : 'member' })) },
      },
      include: { members: { include: { user: { select: userSelect } } } },
    });
    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
});

chatsRouter.get('/:id/messages', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await assertChatMember(id, req.user!.userId);
    const messages = await prisma.message.findMany({
      where: { chatId: id },
      include: {
        author: { select: userSelect },
        readReceipts: { select: { userId: true, readAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(messages.reverse());
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/:id/messages', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { content } = sendMessageSchema.parse(req.body);
    await assertChatMember(id, req.user!.userId);
    const message = await prisma.message.create({
      data: { chatId: id, authorId: req.user!.userId, content, type: 'text' },
      include: {
        author: { select: userSelect },
        readReceipts: { select: { userId: true, readAt: true } },
      },
    });
    await prisma.chat.update({ where: { id }, data: {} });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/messages/:messageId/read', async (req: AuthRequest, res, next) => {
  try {
    const { messageId } = req.params;
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new ApiError(404, 'Message not found');
    if (message.authorId === req.user!.userId) throw new ApiError(400, 'Cannot read own message');
    await assertChatMember(message.chatId, req.user!.userId);
    await prisma.readReceipt.upsert({
      where: { messageId_userId: { messageId, userId: req.user!.userId } },
      create: { messageId, userId: req.user!.userId },
      update: {},
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function assertChatMember(chatId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) throw new ApiError(403, 'Not a chat member');
}
```

- [ ] **Step 2: Modify `services/api/src/routes/index.ts`**

```typescript
import { Router } from 'express';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { contactsRouter } from './contacts.js';
import { chatsRouter } from './chats.js';

export const routes = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));
routes.use('/auth', authRouter);
routes.use('/users', usersRouter);
routes.use('/contacts', contactsRouter);
routes.use('/chats', chatsRouter);
```

- [ ] **Step 3: Write `services/api/tests/chats.test.ts`**

```typescript
import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';

const app = createApp();

async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app).post('/api/auth/register').send({ email, password, displayName });
  return res.body.user as { id: string; email: string };
}

function tokenFor(userId: string, email: string) {
  return signAccessToken({ userId, email });
}

beforeEach(async () => {
  await prisma.readReceipt.deleteMany();
  await prisma.message.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Chats and messages', () => {
  it('creates a group chat and sends a message', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');

    const chatRes = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ title: 'Team', memberIds: [bob.id] });
    expect(chatRes.status).toBe(201);
    const chatId = chatRes.body.id;

    const msgRes = await request(app)
      .post(`/api/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ content: 'Hello team' });
    expect(msgRes.status).toBe(201);
    expect(msgRes.body.content).toBe('Hello team');

    const listRes = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${tokenFor(bob.id, bob.email)}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
  });

  it('marks a message as read', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    const chatRes = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ title: 'Team', memberIds: [bob.id] });
    const chatId = chatRes.body.id;
    const msgRes = await request(app)
      .post(`/api/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${tokenFor(alice.id, alice.email)}`)
      .send({ content: 'Read me' });

    const readRes = await request(app)
      .post(`/api/chats/messages/${msgRes.body.id}/read`)
      .set('Authorization', `Bearer ${tokenFor(bob.id, bob.email)}`);
    expect(readRes.status).toBe(200);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd /home/shugar/dev/pulse-chat/services/api
pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api
git commit -m "feat(api): chats and messages endpoints with tests"
```

---

### Task 7: Socket.io real-time handlers

**Files:**
- Modify: `services/api/src/lib/socket.ts`
- Create: `services/api/tests/socket.test.ts`

- [ ] **Step 1: Write `services/api/src/lib/socket.ts`**

```typescript
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from './jwt.js';
import { prisma } from './prisma.js';

export function setupSocketHandlers(io: Server) {
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
    socket.broadcast.emit('user:presence', { userId, isOnline: true });

    socket.on('chat:join', async ({ chatId }: { chatId: string }) => {
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId } },
      });
      if (member) socket.join(`chat:${chatId}`);
    });

    socket.on('chat:leave', ({ chatId }: { chatId: string }) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on('message:send', async ({ chatId, content }: { chatId: string; content: string }) => {
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId } },
      });
      if (!member) return;
      const message = await prisma.message.create({
        data: { chatId, authorId: userId, content, type: 'text' },
        include: {
          author: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
          readReceipts: { select: { userId: true, readAt: true } },
        },
      });
      await prisma.chat.update({ where: { id: chatId }, data: {} });
      io.to(`chat:${chatId}`).emit('message:new', message);
    });

    socket.on('message:read', async ({ messageId }: { messageId: string }) => {
      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (!message || message.authorId === userId) return;
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: message.chatId, userId } },
      });
      if (!member) return;
      await prisma.readReceipt.upsert({
        where: { messageId_userId: { messageId, userId } },
        create: { messageId, userId },
        update: {},
      });
      io.to(`chat:${message.chatId}`).emit('message:read', { messageId, userId, readAt: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      socket.broadcast.emit('user:presence', { userId, isOnline: false, lastSeenAt: new Date().toISOString() });
    });
  });
}
```

- [ ] **Step 2: Write `services/api/tests/socket.test.ts`**

```typescript
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { createApp, createHttpServer, createIOServer } from '../src/server';
import { setupSocketHandlers } from '../src/lib/socket';
import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import request from 'supertest';

const app = createApp();
const httpServer = createHttpServer(app);
const io = createIOServer(httpServer);
setupSocketHandlers(io);

let serverAddress: string;

beforeAll((done) => {
  httpServer.listen(0, () => {
    const addr = httpServer.address();
    serverAddress = typeof addr === 'object' && addr ? `http://localhost:${addr.port}` : '';
    done();
  });
});

afterAll(() => {
  httpServer.close();
  io.close();
});

beforeEach(async () => {
  await prisma.readReceipt.deleteMany();
  await prisma.message.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.user.deleteMany();
});

async function createUser(email: string, displayName: string) {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'secret123', displayName });
  return res.body.user as { id: string; email: string };
}

function clientFor(userId: string, email: string) {
  return Client(serverAddress, { auth: { token: signAccessToken({ userId, email }) } });
}

describe('Socket.io messaging', () => {
  it('delivers message:new to joined room', async () => {
    const alice = await createUser('alice@example.com', 'Alice');
    const bob = await createUser('bob@example.com', 'Bob');
    const chatRes = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${signAccessToken({ userId: alice.id, email: alice.email })}`)
      .send({ title: 'Room', memberIds: [bob.id] });
    const chatId = chatRes.body.id;

    const bobClient = clientFor(bob.id, bob.email);
    await new Promise<void>((resolve) => bobClient.on('connect', resolve));
    bobClient.emit('chat:join', { chatId });

    const received = new Promise<any>((resolve) => bobClient.on('message:new', resolve));

    const aliceClient = clientFor(alice.id, alice.email);
    await new Promise<void>((resolve) => aliceClient.on('connect', resolve));
    aliceClient.emit('chat:join', { chatId });
    aliceClient.emit('message:send', { chatId, content: 'hi' });

    const msg = await received;
    expect(msg.content).toBe('hi');

    bobClient.disconnect();
    aliceClient.disconnect();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd /home/shugar/dev/pulse-chat/services/api
pnpm test
```

Expected: socket test passes along with previous tests.

- [ ] **Step 4: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api
git commit -m "feat(api): socket.io real-time messaging and presence"
```

---

### Task 8: Mobile Expo skeleton

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/src/App.tsx`
- Modify: `.gitignore` (add Expo entries if missing)

- [ ] **Step 1: Write `apps/mobile/package.json`**

```json
{
  "name": "@pulse-chat/mobile",
  "version": "0.1.0",
  "main": "expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@pulse-chat/shared": "workspace:*",
    "@react-navigation/bottom-tabs": "^7.0.0",
    "@react-navigation/native": "^7.0.0",
    "@react-navigation/native-stack": "^7.0.0",
    "@tanstack/react-query": "^5.62.0",
    "axios": "^1.7.9",
    "expo": "~52.0.0",
    "expo-localization": "~16.0.0",
    "expo-secure-store": "~14.0.0",
    "@react-native-async-storage/async-storage": "1.23.1",
    "expo-status-bar": "~2.0.0",
    "i18next": "^24.1.0",
    "react": "18.3.1",
    "react-i18next": "^15.2.0",
    "react-native": "0.76.5",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0",
    "socket.io-client": "^4.8.1",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@babel/core": "^7.26.0",
    "@types/react": "~18.3.12",
    "jest-expo": "~52.0.0",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Write `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "App.tsx"]
}
```

- [ ] **Step 3: Write `apps/mobile/app.json`**

```json
{
  "expo": {
    "name": "pulse-chat",
    "slug": "pulse-chat",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "scheme": "pulsechat",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "chat.pulse.mobile"
    },
    "android": {
      "package": "chat.pulse.mobile",
      "adaptiveIcon": { "backgroundColor": "#1a2230" }
    },
    "plugins": ["expo-secure-store"]
  }
}
```

- [ ] **Step 4: Write `apps/mobile/babel.config.js`**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

- [ ] **Step 5: Write `apps/mobile/src/App.tsx`**

```tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './i18n';
import { AppNavigator } from './navigation/AppNavigator';
import { SocketProvider } from './context/SocketContext';

const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <SocketProvider>
            <AppNavigator />
          </SocketProvider>
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 6: Install dependencies**

```bash
cd /home/shugar/dev/pulse-chat
pnpm install
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile
git commit -m "chore(mobile): Expo skeleton and dependencies"
```

---

### Task 9: Mobile i18n

**Files:**
- Create: `apps/mobile/src/i18n/index.ts`
- Create: `apps/mobile/src/i18n/locales/en.json`
- Create: `apps/mobile/src/i18n/locales/ru.json`

- [ ] **Step 1: Write `apps/mobile/src/i18n/index.ts`**

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import ru from './locales/ru.json';

const LANGUAGE_KEY = '@pulse-chat/language';

export const resources = { en: { translation: en }, ru: { translation: ru } };

async function getStoredLanguage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

export async function setLanguage(lang: 'ru' | 'en') {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

i18n.use(initReactI18next).init({
  resources,
  lng: Localization.locale.startsWith('en') ? 'en' : 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

getStoredLanguage().then((lang) => {
  if (lang === 'ru' || lang === 'en') i18n.changeLanguage(lang);
});

export default i18n;
```

- [ ] **Step 2: Write `apps/mobile/src/i18n/locales/en.json`**

```json
{
  "welcome": "Welcome to pulse-chat",
  "login": "Login",
  "register": "Register",
  "email": "Email",
  "password": "Password",
  "displayName": "Display name",
  "chats": "Chats",
  "contacts": "Contacts",
  "profile": "Profile",
  "search": "Search",
  "send": "Send",
  "language": "Language",
  "logout": "Logout"
}
```

- [ ] **Step 3: Write `apps/mobile/src/i18n/locales/ru.json`**

```json
{
  "welcome": "Добро пожаловать в pulse-chat",
  "login": "Вход",
  "register": "Регистрация",
  "email": "Email",
  "password": "Пароль",
  "displayName": "Отображаемое имя",
  "chats": "Чаты",
  "contacts": "Контакты",
  "profile": "Профиль",
  "search": "Поиск",
  "send": "Отправить",
  "language": "Язык",
  "logout": "Выйти"
}
```

- [ ] **Step 4: Re-install and commit**

```bash
cd /home/shugar/dev/pulse-chat
pnpm install
```

```bash
git add apps/mobile
git commit -m "feat(mobile): i18n setup with ru/en"
```

---

### Task 10: Mobile API client and auth store

**Files:**
- Create: `apps/mobile/src/api/client.ts`
- Create: `apps/mobile/src/api/auth.ts`
- Create: `apps/mobile/src/stores/authStore.ts`

- [ ] **Step 1: Write `apps/mobile/src/api/client.ts`**

```typescript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

- [ ] **Step 2: Write `apps/mobile/src/api/auth.ts`**

```typescript
import { api } from './client';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@pulse-chat/shared';

export interface AuthResponse {
  user: User;
  tokens: { accessToken: string; refreshToken: string };
}

export async function register(payload: { email: string; password: string; displayName: string }) {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  await SecureStore.setItemAsync('accessToken', data.tokens.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.tokens.refreshToken);
  return data;
}

export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  await SecureStore.setItemAsync('accessToken', data.tokens.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.tokens.refreshToken);
  return data;
}

export async function logout() {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
}
```

- [ ] **Step 3: Write `apps/mobile/src/stores/authStore.ts`**

```typescript
import { create } from 'zustand';
import type { User } from '@pulse-chat/shared';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
}));
```

- [ ] **Step 4: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile
git commit -m "feat(mobile): API client, auth helpers and Zustand auth store"
```

---

### Task 11: Mobile navigation and auth screens

**Files:**
- Create: `apps/mobile/src/navigation/AppNavigator.tsx`
- Create: `apps/mobile/src/navigation/AuthNavigator.tsx`
- Create: `apps/mobile/src/navigation/MainNavigator.tsx`
- Create: `apps/mobile/src/screens/WelcomeScreen.tsx`
- Create: `apps/mobile/src/screens/LoginScreen.tsx`
- Create: `apps/mobile/src/screens/RegisterScreen.tsx`

- [ ] **Step 1: Write `apps/mobile/src/navigation/AppNavigator.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../stores/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { api } from '../api/client';

export function AppNavigator() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync('accessToken').then(async (token) => {
      if (token) {
        try {
          const { data } = await api.get('/users/me');
          setUser(data);
        } catch {
          await SecureStore.deleteItemAsync('accessToken');
        }
      }
      setLoading(false);
    });
  }, [setUser]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return user ? <MainNavigator /> : <AuthNavigator />;
}
```

- [ ] **Step 2: Write `apps/mobile/src/navigation/AuthNavigator.tsx`**

```tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';

const Stack = createNativeStackNavigator();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 3: Write `apps/mobile/src/navigation/MainNavigator.tsx`**

```tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChatsScreen } from '../screens/ChatsScreen';
import { ContactsScreen } from '../screens/ContactsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ChatScreen } from '../screens/ChatScreen';

const Tab = createBottomTabNavigator();
const ChatStack = createNativeStackNavigator();

function ChatStackNavigator() {
  return (
    <ChatStack.Navigator>
      <ChatStack.Screen name="ChatsList" component={ChatsScreen} options={{ title: 'Chats' }} />
      <ChatStack.Screen name="Chat" component={ChatScreen} />
    </ChatStack.Navigator>
  );
}

export function MainNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="ChatsTab" component={ChatStackNavigator} options={{ tabBarLabel: t('chats'), tabBarIcon: () => <Text>💬</Text> }} />
      <Tab.Screen name="ContactsTab" component={ContactsScreen} options={{ tabBarLabel: t('contacts'), tabBarIcon: () => <Text>👥</Text> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: t('profile'), tabBarIcon: () => <Text>⚙️</Text> }} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 4: Write `apps/mobile/src/screens/WelcomeScreen.tsx`**

```tsx
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any>;

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('welcome')}</Text>
      <Button title={t('login')} onPress={() => navigation.navigate('Login')} />
      <View style={styles.gap} />
      <Button title={t('register')} onPress={() => navigation.navigate('Register')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  gap: { height: 12 },
});
```

- [ ] **Step 5: Write `apps/mobile/src/screens/LoginScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { login } from '../api/auth';
import { useAuthStore } from '../stores/authStore';

type Props = NativeStackScreenProps<any>;

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      const { user } = await login({ email, password });
      setUser(user);
    } catch {
      setError(t('login') + ' failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('login')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput style={styles.input} placeholder={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder={t('password')} value={password} onChangeText={setPassword} secureTextEntry />
      <Button title={t('login')} onPress={handleLogin} />
      <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
        {t('register')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  error: { color: 'red' },
  link: { color: 'blue', marginTop: 12, textAlign: 'center' },
});
```

- [ ] **Step 6: Write `apps/mobile/src/screens/RegisterScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { register } from '../api/auth';
import { useAuthStore } from '../stores/authStore';

type Props = NativeStackScreenProps<any>;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async () => {
    try {
      const { user } = await register({ email, password, displayName });
      setUser(user);
    } catch {
      setError(t('register') + ' failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('register')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput style={styles.input} placeholder={t('displayName')} value={displayName} onChangeText={setDisplayName} />
      <TextInput style={styles.input} placeholder={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder={t('password')} value={password} onChangeText={setPassword} secureTextEntry />
      <Button title={t('register')} onPress={handleRegister} />
      <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
        {t('login')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  error: { color: 'red' },
  link: { color: 'blue', marginTop: 12, textAlign: 'center' },
});
```

- [ ] **Step 7: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile
git commit -m "feat(mobile): auth screens and navigation"
```

---

### Task 12: Mobile contacts screen

**Files:**
- Create: `apps/mobile/src/api/contacts.ts`
- Create: `apps/mobile/src/screens/ContactsScreen.tsx`

- [ ] **Step 1: Write `apps/mobile/src/api/contacts.ts`**

```typescript
import { api } from './client';

export interface Contact {
  id: string;
  status: 'pending' | 'accepted' | 'blocked';
  target: { id: string; email: string; displayName: string; avatarUrl: string | null };
}

export function searchUsers(q: string) {
  return api.get('/users/search', { params: { q } }).then((r) => r.data);
}

export function listContacts() {
  return api.get<Contact[]>('/contacts').then((r) => r.data);
}

export function addContact(targetId: string) {
  return api.post<Contact>('/contacts', { targetId }).then((r) => r.data);
}

export function updateContact(id: string, status: 'accepted' | 'blocked' | 'removed') {
  return api.patch<Contact>(`/contacts/${id}`, { status }).then((r) => r.data);
}
```

- [ ] **Step 2: Write `apps/mobile/src/screens/ContactsScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, Button, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listContacts, searchUsers, addContact, updateContact } from '../api/contacts';

export function ContactsScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const { data: contacts } = useQuery({ queryKey: ['contacts'], queryFn: listContacts });
  const { data: searchResults } = useQuery({
    queryKey: ['users', 'search', query],
    queryFn: () => searchUsers(query),
    enabled: query.length > 2,
  });

  const addMutation = useMutation({
    mutationFn: addContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'blocked' | 'removed' }) => updateContact(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('contacts')}</Text>
      <TextInput style={styles.input} placeholder={t('search')} value={query} onChangeText={setQuery} />
      {query.length > 2 && searchResults?.length === 0 ? <Text>No users found</Text> : null}
      <FlatList
        data={searchResults || []}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>{item.displayName} ({item.email})</Text>
            <Button title="+" onPress={() => addMutation.mutate(item.id)} />
          </View>
        )}
      />
      <Text style={styles.section}>My contacts</Text>
      <FlatList
        data={contacts || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>{item.target.displayName} — {item.status}</Text>
            {item.status === 'pending' ? (
              <Button title="Accept" onPress={() => updateMutation.mutate({ id: item.id, status: 'accepted' })} />
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
});
```

- [ ] **Step 3: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile
git commit -m "feat(mobile): contacts search and management"
```

---

### Task 13: Mobile chats list and chat screen

**Files:**
- Create: `apps/mobile/src/api/chats.ts`
- Create: `apps/mobile/src/context/SocketContext.tsx`
- Modify: `apps/mobile/src/navigation/MainNavigator.tsx` (ensure Chat screen in stack)
- Create: `apps/mobile/src/screens/ChatsScreen.tsx`
- Create: `apps/mobile/src/screens/ChatScreen.tsx`

- [ ] **Step 1: Write `apps/mobile/src/api/chats.ts`**

```typescript
import { api } from './client';
import type { Chat, Message } from '@pulse-chat/shared';

export function listChats() {
  return api.get<Chat[]>('/chats').then((r) => r.data);
}

export function createGroupChat(title: string, memberIds: string[]) {
  return api.post<Chat>('/chats', { title, memberIds }).then((r) => r.data);
}

export function listMessages(chatId: string) {
  return api.get<Message[]>(`/chats/${chatId}/messages`).then((r) => r.data);
}

export function sendMessage(chatId: string, content: string) {
  return api.post<Message>(`/chats/${chatId}/messages`, { content }).then((r) => r.data);
}

export function readMessage(messageId: string) {
  return api.post(`/chats/messages/${messageId}/read`).then((r) => r.data);
}
```

- [ ] **Step 2: Write `apps/mobile/src/context/SocketContext.tsx`**

```tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('accessToken').then((token) => {
      if (!token) {
        setReady(true);
        return;
      }
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
      const socket = io(API_URL, { auth: { token } });
      socketRef.current = socket;
      socket.on('connect', () => setReady(true));
      socket.on('disconnect', () => setReady(false));
    });
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return <SocketContext.Provider value={socketRef.current}>{ready ? children : null}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
```

- [ ] **Step 3: Write `apps/mobile/src/screens/ChatsScreen.tsx`**

```tsx
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listChats } from '../api/chats';
import { useAuthStore } from '../stores/authStore';

type Props = NativeStackScreenProps<any>;

export function ChatsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { data: chats } = useQuery({ queryKey: ['chats'], queryFn: listChats });

  const titleFor = (chat: any) => {
    if (chat.title) return chat.title;
    const other = chat.members.find((m: any) => m.user.id !== user?.id)?.user;
    return other?.displayName || t('chats');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('chats')}</Text>
      <FlatList
        data={chats || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Chat', { chatId: item.id, title: titleFor(item) })}>
            <Text style={styles.name}>{titleFor(item)}</Text>
            <Text style={styles.preview}>{item.messages?.[0]?.content || ''}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 16, fontWeight: '600' },
  preview: { color: '#666', marginTop: 4 },
});
```

- [ ] **Step 4: Write `apps/mobile/src/screens/ChatScreen.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, Button, FlatList, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listMessages, sendMessage, readMessage } from '../api/chats';
import { useSocket } from '../context/SocketContext';
import { useAuthStore } from '../stores/authStore';
import type { Message } from '@pulse-chat/shared';

type Props = NativeStackScreenProps<any>;

export function ChatScreen({ route }: Props) {
  const { chatId, title } = route.params as { chatId: string; title: string };
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const { data: messages } = useQuery({ queryKey: ['messages', chatId], queryFn: () => listMessages(chatId) });
  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(chatId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', chatId] }),
  });

  useEffect(() => {
    if (!socket) return;
    socket.emit('chat:join', { chatId });
    const onNew = (msg: Message) => {
      if (msg.chatId !== chatId) return;
      queryClient.setQueryData(['messages', chatId], (old: Message[] = []) => [...old, msg]);
      if (msg.authorId !== user?.id) readMessage(msg.id);
    };
    const onRead = ({ messageId }: { messageId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    };
    socket.on('message:new', onNew);
    socket.on('message:read', onRead);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:read', onRead);
      socket.emit('chat:leave', { chatId });
    };
  }, [socket, chatId, queryClient]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={messages || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text style={styles.author}>{item.author.displayName}</Text>
            <Text>{item.content}</Text>
            <Text style={styles.meta}>{item.readBy.length > 0 ? '✓✓' : '✓'}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder={t('send')} />
        <Button title={t('send')} onPress={() => { sendMutation.mutate(text); setText(''); }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  bubble: { backgroundColor: '#f0f0f0', borderRadius: 8, padding: 10, marginBottom: 8 },
  author: { fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 11, color: '#888', marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
});
```

- [ ] **Step 5: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile
git commit -m "feat(mobile): chat list, chat screen and socket context"
```

---

### Task 14: Profile screen and language switch

**Files:**
- Create: `apps/mobile/src/screens/ProfileScreen.tsx`

- [ ] **Step 1: Write `apps/mobile/src/screens/ProfileScreen.tsx`**

```tsx
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { logout } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { setLanguage } from '../i18n';

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuthStore();

  const toggleLanguage = async () => {
    const next = i18n.language === 'ru' ? 'en' : 'ru';
    await setLanguage(next);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile')}</Text>
      <Text style={styles.label}>{user?.displayName}</Text>
      <Text style={styles.label}>{user?.email}</Text>
      <View style={styles.gap} />
      <Button title={`${t('language')}: ${i18n.language.toUpperCase()}`} onPress={toggleLanguage} />
      <View style={styles.gap} />
      <Button title={t('logout')} onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  label: { fontSize: 16, marginBottom: 4 },
  gap: { height: 12 },
});
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add apps/mobile
git commit -m "feat(mobile): profile screen with language switch and logout"
```

---

### Task 15: Final verification and documentation update

**Files:**
- Modify: `README.md`
- Modify: `services/api/package.json` (add lint script if missing)

- [ ] **Step 1: Run backend tests one final time**

```bash
cd /home/shugar/dev/pulse-chat/services/api
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript checks**

```bash
cd /home/shugar/dev/pulse-chat/services/api
pnpm exec tsc --noEmit
cd ../apps/mobile
pnpm exec tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Update `README.md` quick start section**

Replace the placeholder quick start with:

```markdown
## Быстрый старт

```bash
# 1. Зависимости
pnpm install

# 2. Переменные окружения
cp .env.example .env
# отредактируй .env, убедись что DATABASE_URL указывает на запущенный Postgres

# 3. База данных
docker compose up -d
cd services/api
pnpm exec prisma migrate dev

# 4. Бэкенд
pnpm dev

# 5. Мобильное приложение (новое окно)
cd ../../apps/mobile
pnpm start
```
```

- [ ] **Step 4: Final commit**

```bash
cd /home/shugar/dev/pulse-chat
git add README.md
git commit -m "docs: update quick start in README"
```

---

## Spec coverage check

| Spec requirement | Implementing task |
|------------------|-------------------|
| Registration/login with JWT | Task 4 |
| Contacts (add, accept, block, list) | Task 5 |
| 1-to-1 and group chats | Task 5, Task 6 |
| Real-time text messages | Task 7 |
| Read receipts | Task 6, Task 7 |
| ru/en localization | Task 9, Task 14 |
| PostgreSQL via Prisma | Task 3 |
| Docker-based backend | Task 1, Task 3 |
| Expo / React Native client | Task 8 |

## Placeholder scan

- No TBD/TODO/fill-in-details statements.
- Every code step includes the actual file content.
- Every test step includes exact test code and expected output.

## Type consistency check

- `User` type is defined in `@pulse-chat/shared` and reused in client API and store.
- `AuthRequest.user` uses `TokenPayload` from `lib/jwt.ts` consistently.
- Socket event names (`message:new`, `message:read`, `chat:join`, `chat:leave`, `user:presence`) match between server and client.

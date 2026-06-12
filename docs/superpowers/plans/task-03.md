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

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}

export function createHttpServer(app: express.Express): ReturnType<typeof createServer> {
  return createServer(app);
}

export function createIOServer(httpServer: ReturnType<typeof createServer>): Server {
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

export const routes: Router = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));
```

Note: the `Router` type annotation is required for declaration emit.

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


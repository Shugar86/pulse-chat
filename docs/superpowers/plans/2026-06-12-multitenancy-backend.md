# Multitenancy Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` task-by-task.

**Goal:** Isolate users, contacts and chats by company/tenant while allowing one user to belong to multiple tenants.

**Architecture:** Global users + per-tenant memberships (`TenantMembership`). Every tenant-scoped request carries `X-Tenant-Id`; middleware validates membership. `Contact` and `Chat` gain a required `tenantId`. Registration creates a default tenant; additional tenants can be created or joined via invite code.

**Tech Stack:** Node.js, Express, Prisma, PostgreSQL, Socket.io, JWT.

---

### Task 1: Update Prisma schema

**Files:**
- Modify: `services/api/prisma/schema.prisma`

- [ ] **Step 1: Add Tenant, TenantMembership, TenantInvite and roles**

Replace `schema.prisma` with:

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

  ownedContacts    Contact[]          @relation("ContactOwner")
  targetOfContacts Contact[]          @relation("ContactTarget")
  memberships      TenantMembership[]
  messages         Message[]
  readReceipts     ReadReceipt[]
}

model Tenant {
  id        String             @id @default(uuid())
  name      String
  slug      String             @unique
  createdAt DateTime           @default(now())
  members   TenantMembership[]
  contacts  Contact[]
  chats     Chat[]
  invites   TenantInvite[]
}

model TenantMembership {
  id       String     @id @default(uuid())
  tenantId String
  userId   String
  role     TenantRole @default(member)
  joinedAt DateTime   @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([tenantId, userId])
  @@index([tenantId])
  @@index([userId])
}

enum TenantRole {
  owner
  admin
  member
}

model TenantInvite {
  id        String   @id @default(uuid())
  tenantId  String
  code      String   @unique
  createdBy String
  expiresAt DateTime
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}

model Contact {
  id        String        @id @default(uuid())
  tenantId  String
  ownerId   String
  targetId  String
  status    ContactStatus @default(pending)
  createdAt DateTime      @default(now())

  owner  User @relation("ContactOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  target User @relation("ContactTarget", fields: [targetId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, ownerId, targetId])
  @@index([tenantId])
  @@index([ownerId])
  @@index([targetId])
}

enum ContactStatus {
  pending
  accepted
  blocked
  removed
}

model Chat {
  id        String   @id @default(uuid())
  tenantId  String
  type      ChatType
  title     String?
  avatarUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members  ChatMember[]
  messages Message[]
  tenant   Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
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
  @@index([chatId])
  @@index([userId])
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
  author       User          @relation(fields: [authorId], references: [id], onDelete: Cascade)
  readReceipts ReadReceipt[]

  @@index([chatId])
  @@index([authorId])
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
  @@index([messageId])
  @@index([userId])
}
```

- [ ] **Step 2: Create and apply migration**

Run:
```bash
cd /home/shugar/dev/pulse-chat/services/api
pnpm exec prisma migrate dev --name multitenancy
```
If Prisma asks to reset the database because existing rows cannot satisfy the new `tenantId` NOT NULL, confirm — this is pre-release.

- [ ] **Step 3: Regenerate Prisma Client**

```bash
cd /home/shugar/dev/pulse-chat/services/api
pnpm exec prisma generate
```

- [ ] **Step 4: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api/prisma/schema.prisma services/api/prisma/migrations
git commit -m "chore(api): add Tenant, Membership, Invite and tenantId columns"
```

---

### Task 2: Update shared types

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add Tenant and TenantMembership to shared package**

Replace the file with:

```ts
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  preferredLanguage: 'ru' | 'en';
  createdAt: string;
  lastSeenAt: string;
  tenants: TenantMembership[];
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface TenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  tenant: Tenant;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  avatarUrl: string | null;
  updatedAt: string;
  members: ChatMember[];
  messages?: Message[];
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

- [ ] **Step 2: Type-check shared package**

```bash
cd /home/shugar/dev/pulse-chat/packages/shared && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add packages/shared/src/index.ts
git commit -m "chore(shared): add Tenant and TenantMembership types"
```

---

### Task 3: Tenant middleware

**Files:**
- Create: `services/api/src/middleware/tenant.ts`

- [ ] **Step 1: Write middleware**

```ts
import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from './auth.js';
import { ApiError } from './error.js';

export interface TenantRequest extends AuthRequest {
  tenantId?: string;
}

export async function requireTenant(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    if (!tenantId) throw new ApiError(400, 'Tenant id required');

    const membership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: req.user!.userId } },
    });
    if (!membership) throw new ApiError(403, 'Not a tenant member');

    req.tenantId = tenantId;
    return next();
  } catch (err) {
    return next(err);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api/src/middleware/tenant.ts
git commit -m "feat(api): add requireTenant middleware"
```

---

### Task 4: Update auth routes

**Files:**
- Modify: `services/api/src/routes/auth.ts`

- [ ] **Step 1: Update register and login to create/return tenants**

Replace the file with:

```ts
import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, TokenPayload } from '../lib/jwt.js';
import { ApiError } from '../middleware/error.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
  tenantName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50) || 'tenant';
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let counter = 1;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

const userSelect = { id: true, email: true, displayName: true, preferredLanguage: true, avatarUrl: true, lastSeenAt: true };
const tenantSelect = { id: true, name: true, slug: true };

function mapMembership(m: any) {
  return { id: m.id, tenantId: m.tenantId, userId: m.userId, role: m.role, tenant: m.tenant };
}

export const authRouter: Router = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, 'Email already in use');

    const passwordHash = await argon2.hash(data.password);
    const slug = await uniqueSlug(data.tenantName);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash, displayName: data.displayName }, select: userSelect });
      const tenant = await tx.tenant.create({ data: { name: data.tenantName, slug }, select: tenantSelect });
      const membership = await tx.tenantMembership.create({
        data: { tenantId: tenant.id, userId: user.id, role: 'owner' },
        include: { tenant: { select: tenantSelect } },
      });
      return { user, membership };
    });

    const tokens = {
      accessToken: signAccessToken({ userId: result.user.id, email: result.user.email }),
      refreshToken: signRefreshToken({ userId: result.user.id, email: result.user.email }),
    };
    res.status(201).json({ user: { ...result.user, tenants: [mapMembership(result.membership)] }, tokens });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(401, 'Invalid credentials');
    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) throw new ApiError(401, 'Invalid credentials');

    const memberships = await prisma.tenantMembership.findMany({
      where: { userId: user.id },
      include: { tenant: { select: tenantSelect } },
    });

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
        avatarUrl: user.avatarUrl,
        lastSeenAt: user.lastSeenAt.toISOString(),
        tenants: memberships.map(mapMembership),
      },
      tokens,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, 'Invalid refresh token');
    }
    const accessToken = signAccessToken({ userId: payload.userId, email: payload.email });
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api/src/routes/auth.ts
git commit -m "feat(api): register creates tenant and login returns memberships"
```

---

### Task 5: Update users routes

**Files:**
- Modify: `services/api/src/routes/users.ts`

- [ ] **Step 1: Include tenants in /me and scope search by tenant**

Replace the file with:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireTenant, TenantRequest } from '../middleware/tenant.js';

const updateProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  preferredLanguage: z.enum(['ru', 'en']).optional(),
});

const tenantSelect = { id: true, name: true, slug: true };

function mapMembership(m: any) {
  return { id: m.id, tenantId: m.tenantId, userId: m.userId, role: m.role, tenant: m.tenant };
}

export const usersRouter: Router = Router();

usersRouter.use(requireAuth);

usersRouter.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        preferredLanguage: true,
        lastSeenAt: true,
        memberships: { include: { tenant: { select: tenantSelect } } },
      },
    });
    res.json({
      ...user,
      lastSeenAt: user.lastSeenAt.toISOString(),
      tenants: user.memberships.map(mapMembership),
    });
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
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        preferredLanguage: true,
        lastSeenAt: true,
        memberships: { include: { tenant: { select: tenantSelect } } },
      },
    });
    res.json({
      ...user,
      lastSeenAt: user.lastSeenAt.toISOString(),
      tenants: user.memberships.map(mapMembership),
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/search', requireTenant, async (req: TenantRequest, res, next) => {
  try {
    const q = z.string().min(1).parse(req.query.q);
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user!.userId },
        memberships: { some: { tenantId: req.tenantId } },
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
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

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api/src/routes/users.ts services/api/src/middleware/tenant.ts
git commit -m "feat(api): scope user search by tenant and return memberships"
```

---

### Task 6: Update contacts routes

**Files:**
- Modify: `services/api/src/routes/contacts.ts`

- [ ] **Step 1: Scope contacts by tenant**

Replace the file with:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireTenant, TenantRequest } from '../middleware/tenant.js';
import { ApiError } from '../middleware/error.js';

const contactActionSchema = z.object({
  status: z.enum(['accepted', 'blocked', 'removed']),
});

const targetSelect = { id: true, email: true, displayName: true, avatarUrl: true, lastSeenAt: true };

export const contactsRouter: Router = Router();

contactsRouter.use(requireAuth, requireTenant);

contactsRouter.get('/', async (req: TenantRequest, res, next) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { tenantId: req.tenantId, ownerId: req.user!.userId, status: { not: 'removed' } },
      include: { target: { select: targetSelect } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(contacts);
  } catch (err) {
    next(err);
  }
});

contactsRouter.post('/', async (req: TenantRequest, res, next) => {
  try {
    const { targetId } = z.object({ targetId: z.string().uuid() }).parse(req.body);
    if (targetId === req.user!.userId) throw new ApiError(400, 'Cannot add yourself');

    const targetMembership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: req.tenantId!, userId: targetId } },
    });
    if (!targetMembership) throw new ApiError(404, 'Target user not found in tenant');

    const existing = await prisma.contact.findUnique({
      where: { tenantId_ownerId_targetId: { tenantId: req.tenantId!, ownerId: req.user!.userId, targetId } },
    });
    if (existing) throw new ApiError(409, 'Contact request already exists');

    const contact = await prisma.contact.create({
      data: { tenantId: req.tenantId!, ownerId: req.user!.userId, targetId },
      include: { target: { select: targetSelect } },
    });
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

contactsRouter.patch('/:id', async (req: TenantRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { status } = contactActionSchema.parse(req.body);

    const contact = await prisma.contact.findFirst({
      where: { id, tenantId: req.tenantId, ownerId: req.user!.userId },
    });
    if (!contact) throw new ApiError(404, 'Contact not found');

    if (status === 'accepted') {
      const other = await prisma.contact.findUnique({
        where: { tenantId_ownerId_targetId: { tenantId: req.tenantId!, ownerId: contact.targetId, targetId: contact.ownerId } },
      });
      if (other?.status === 'blocked') {
        throw new ApiError(403, 'Contact is blocked');
      }
    }

    if (status === 'removed') {
      await prisma.contact.delete({ where: { id } });
      return res.status(204).send();
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: { status },
      include: { target: { select: targetSelect } },
    });

    if (status === 'accepted') {
      const other = await prisma.contact.findUnique({
        where: { tenantId_ownerId_targetId: { tenantId: req.tenantId!, ownerId: contact.targetId, targetId: contact.ownerId } },
      });
      if (!other) {
        await prisma.contact.create({
          data: { tenantId: req.tenantId!, ownerId: contact.targetId, targetId: contact.ownerId, status: 'accepted' },
        });
      } else if (other.status === 'pending') {
        await prisma.contact.update({ where: { id: other.id }, data: { status: 'accepted' } });
      }
      await ensureDirectChat(req.tenantId!, contact.ownerId, contact.targetId);
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

async function ensureDirectChat(tenantId: string, userA: string, userB: string) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT c.id FROM "Chat" c
    JOIN "ChatMember" m1 ON c.id = m1."chatId" AND m1."userId" = ${userA}
    JOIN "ChatMember" m2 ON c.id = m2."chatId" AND m2."userId" = ${userB}
    WHERE c.type = 'direct' AND c."tenantId" = ${tenantId}
    LIMIT 1
  `;
  if (existing.length > 0) {
    return prisma.chat.findUnique({ where: { id: existing[0].id } });
  }

  return prisma.chat.create({
    data: {
      tenantId,
      type: 'direct',
      members: { create: [{ userId: userA }, { userId: userB }] },
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api/src/routes/contacts.ts
git commit -m "feat(api): scope contacts and direct chats by tenant"
```

---

### Task 7: Update chats routes

**Files:**
- Modify: `services/api/src/routes/chats.ts`

- [ ] **Step 1: Scope chats and messages by tenant**

Replace the file with:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireTenant, TenantRequest } from '../middleware/tenant.js';
import { ApiError } from '../middleware/error.js';

const createGroupSchema = z.object({
  title: z.string().min(1),
  memberIds: z.array(z.string().uuid()).min(1),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const userSelect = { id: true, email: true, displayName: true, avatarUrl: true };

export const chatsRouter: Router = Router();

chatsRouter.use(requireAuth, requireTenant);

chatsRouter.get('/', async (req: TenantRequest, res, next) => {
  try {
    const chats = await prisma.chat.findMany({
      where: { tenantId: req.tenantId, members: { some: { userId: req.user!.userId } } },
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

chatsRouter.post('/', async (req: TenantRequest, res, next) => {
  try {
    const { title, memberIds } = createGroupSchema.parse(req.body);

    const uniqueMemberIds = Array.from(new Set(memberIds));
    const tenantMembers = await prisma.tenantMembership.findMany({
      where: { tenantId: req.tenantId, userId: { in: uniqueMemberIds } },
      select: { userId: true },
    });
    if (tenantMembers.length !== uniqueMemberIds.length) {
      throw new ApiError(400, 'One or more members do not exist in this tenant');
    }

    const allMembers = Array.from(new Set([req.user!.userId, ...uniqueMemberIds]));
    const chat = await prisma.chat.create({
      data: {
        tenantId: req.tenantId!,
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

chatsRouter.get('/:id/messages', async (req: TenantRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    await assertChatMember(id, req.user!.userId, req.tenantId!);
    const rawMessages = await prisma.message.findMany({
      where: { chatId: id },
      include: {
        author: { select: userSelect },
        readReceipts: { select: { userId: true, readAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const messages = rawMessages.reverse().map((message) => {
      const { readReceipts, ...rest } = message;
      return { ...rest, readBy: readReceipts.map((r) => ({ userId: r.userId, readAt: r.readAt.toISOString() })) };
    });
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/:id/messages', async (req: TenantRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { content } = sendMessageSchema.parse(req.body);
    await assertChatMember(id, req.user!.userId, req.tenantId!);
    const rawMessage = await prisma.message.create({
      data: { chatId: id, authorId: req.user!.userId, content, type: 'text' },
      include: {
        author: { select: userSelect },
        readReceipts: { select: { userId: true, readAt: true } },
      },
    });
    await prisma.chat.update({ where: { id }, data: {} });
    const { readReceipts, ...rest } = rawMessage;
    const message = { ...rest, readBy: readReceipts.map((r) => ({ userId: r.userId, readAt: r.readAt.toISOString() })) };
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

chatsRouter.post('/messages/:messageId/read', async (req: TenantRequest, res, next) => {
  try {
    const messageId = z.string().uuid().parse(req.params.messageId);
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new ApiError(404, 'Message not found');
    if (message.authorId === req.user!.userId) throw new ApiError(400, 'Cannot read own message');
    await assertChatMember(message.chatId, req.user!.userId, req.tenantId!);
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

async function assertChatMember(chatId: string, userId: string, tenantId: string) {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat || chat.tenantId !== tenantId) throw new ApiError(403, 'Not a chat member');
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) throw new ApiError(403, 'Not a chat member');
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api/src/routes/chats.ts
git commit -m "feat(api): scope chats and messages by tenant"
```

---

### Task 8: Add tenant routes

**Files:**
- Create: `services/api/src/routes/tenants.ts`
- Modify: `services/api/src/routes/index.ts`

- [ ] **Step 1: Write tenant routes**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50) || 'tenant';
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let counter = 1;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

function generateCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

const tenantSelect = { id: true, name: true, slug: true };

function mapMembership(m: any) {
  return { id: m.id, tenantId: m.tenantId, userId: m.userId, role: m.role, tenant: m.tenant };
}

export const tenantsRouter: Router = Router();

tenantsRouter.use(requireAuth);

tenantsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const memberships = await prisma.tenantMembership.findMany({
      where: { userId: req.user!.userId },
      include: { tenant: { select: tenantSelect } },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(memberships.map(mapMembership));
  } catch (err) {
    next(err);
  }
});

tenantsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const slug = await uniqueSlug(name);
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name, slug }, select: tenantSelect });
      const membership = await tx.tenantMembership.create({
        data: { tenantId: tenant.id, userId: req.user!.userId, role: 'owner' },
        include: { tenant: { select: tenantSelect } },
      });
      return membership;
    });
    res.status(201).json(mapMembership(result));
  } catch (err) {
    next(err);
  }
});

tenantsRouter.post('/join', async (req: AuthRequest, res, next) => {
  try {
    const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
    const invite = await prisma.tenantInvite.findUnique({ where: { code: code.toUpperCase() } });
    if (!invite) throw new ApiError(404, 'Invite not found');
    if (invite.expiresAt < new Date()) throw new ApiError(410, 'Invite expired');

    const existing = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: invite.tenantId, userId: req.user!.userId } },
    });
    if (existing) throw new ApiError(409, 'Already a member');

    const membership = await prisma.tenantMembership.create({
      data: { tenantId: invite.tenantId, userId: req.user!.userId, role: 'member' },
      include: { tenant: { select: tenantSelect } },
    });
    res.status(201).json(mapMembership(membership));
  } catch (err) {
    next(err);
  }
});

tenantsRouter.post('/:id/invites', async (req: AuthRequest, res, next) => {
  try {
    const tenantId = z.string().uuid().parse(req.params.id);
    const membership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: req.user!.userId } },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      throw new ApiError(403, 'Only owner or admin can invite');
    }

    const code = generateCode();
    const invite = await prisma.tenantInvite.create({
      data: {
        tenantId,
        code,
        createdBy: req.user!.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    res.status(201).json({ code: invite.code });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Mount tenant routes**

In `services/api/src/routes/index.ts`, add:

```ts
import { tenantsRouter } from './tenants.js';
```

and after users:

```ts
routes.use('/tenants', tenantsRouter);
```

The file should look like:

```ts
import { Router } from 'express';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { tenantsRouter } from './tenants.js';
import { contactsRouter } from './contacts.js';
import { chatsRouter } from './chats.js';

export const routes: Router = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));
routes.use('/auth', authRouter);
routes.use('/users', usersRouter);
routes.use('/tenants', tenantsRouter);
routes.use('/contacts', contactsRouter);
routes.use('/chats', chatsRouter);
```

- [ ] **Step 3: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api/src/routes/tenants.ts services/api/src/routes/index.ts
git commit -m "feat(api): add tenant list, create, join and invite endpoints"
```

---

### Task 9: Scope socket.io by tenant

**Files:**
- Modify: `services/api/src/lib/socket.ts`

- [ ] **Step 1: Read tenantId from handshake and validate membership**

Replace the file with:

```ts
import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { verifyAccessToken } from './jwt.js';
import { prisma } from './prisma.js';

const chatIdEventSchema = z.object({ chatId: z.string().uuid() });
const sendMessageEventSchema = z.object({
  chatId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});
const readMessageEventSchema = z.object({ messageId: z.string().uuid() });

const userSelect = { id: true, email: true, displayName: true, avatarUrl: true };

function formatMessage(message: {
  id: string;
  chatId: string;
  authorId: string;
  type: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: string; email: string; displayName: string; avatarUrl: string | null };
  readReceipts: { userId: string; readAt: Date }[];
}) {
  const { readReceipts, ...rest } = message;
  return { ...rest, readBy: readReceipts.map((r) => ({ userId: r.userId, readAt: r.readAt.toISOString() })) };
}

export function setupSocketHandlers(io: Server) {
  const onlineSockets = new Map<string, Set<string>>();

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    const tenantId = socket.handshake.auth.tenantId as string | undefined;
    if (!token || !tenantId) return next(new Error('Unauthorized'));
    try {
      const payload = verifyAccessToken(token);
      const membership = await prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: payload.userId } },
      });
      if (!membership) return next(new Error('Unauthorized'));
      socket.data.userId = payload.userId;
      socket.data.tenantId = tenantId;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    const tenantId = socket.data.tenantId as string;

    socket.join(`user:${userId}`);

    const sockets = onlineSockets.get(userId) ?? new Set<string>();
    const wasOnline = sockets.size > 0;
    sockets.add(socket.id);
    onlineSockets.set(userId, sockets);

    socket.on('chat:join', async (data) => {
      try {
        const { chatId } = chatIdEventSchema.parse(data);
        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || chat.tenantId !== tenantId) {
          return socket.emit('error', { message: 'Not a chat member' });
        }
        const member = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId, userId } },
        });
        if (!member) {
          return socket.emit('error', { message: 'Not a chat member' });
        }
        socket.join(`chat:${chatId}`);
      } catch (err) {
        socket.emit('error', { message: 'Invalid chat:join payload' });
      }
    });

    socket.on('chat:leave', (data) => {
      try {
        const { chatId } = chatIdEventSchema.parse(data);
        socket.leave(`chat:${chatId}`);
      } catch (err) {
        socket.emit('error', { message: 'Invalid chat:leave payload' });
      }
    });

    socket.on('message:send', async (data) => {
      try {
        const { chatId, content } = sendMessageEventSchema.parse(data);
        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || chat.tenantId !== tenantId) {
          return socket.emit('error', { message: 'Not a chat member' });
        }
        const member = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId, userId } },
        });
        if (!member) {
          return socket.emit('error', { message: 'Not a chat member' });
        }
        const message = await prisma.message.create({
          data: { chatId, authorId: userId, content, type: 'text' },
          include: {
            author: { select: userSelect },
            readReceipts: { select: { userId: true, readAt: true } },
          },
        });
        await prisma.chat.update({ where: { id: chatId }, data: {} });
        io.to(`chat:${chatId}`).emit('message:new', formatMessage(message));
      } catch (err) {
        socket.emit('error', { message: 'Invalid message:send payload' });
      }
    });

    socket.on('message:read', async (data) => {
      try {
        const { messageId } = readMessageEventSchema.parse(data);
        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message || message.authorId === userId) {
          return socket.emit('error', { message: 'Cannot read this message' });
        }
        const chat = await prisma.chat.findUnique({ where: { id: message.chatId } });
        if (!chat || chat.tenantId !== tenantId) {
          return socket.emit('error', { message: 'Not a chat member' });
        }
        const member = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId: message.chatId, userId } },
        });
        if (!member) {
          return socket.emit('error', { message: 'Not a chat member' });
        }
        await prisma.readReceipt.upsert({
          where: { messageId_userId: { messageId, userId } },
          create: { messageId, userId },
          update: {},
        });
        io.to(`chat:${message.chatId}`).emit('message:read', {
          messageId,
          userId,
          readAt: new Date().toISOString(),
        });
      } catch (err) {
        socket.emit('error', { message: 'Invalid message:read payload' });
      }
    });

    socket.on('disconnect', async () => {
      const sockets = onlineSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineSockets.delete(userId);
          try {
            await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
            await broadcastPresence(io, userId, tenantId, false);
          } catch {
            // ignore
          }
        }
      }
    });

    if (!wasOnline) {
      try {
        await broadcastPresence(io, userId, tenantId, true);
      } catch (err) {
        socket.emit('error', { message: 'Presence update failed' });
      }
    }
  });
}

async function broadcastPresence(io: Server, userId: string, tenantId: string, isOnline: boolean) {
  const contacts = await prisma.contact.findMany({
    where: {
      tenantId,
      ownerId: userId,
      status: 'accepted',
    },
    select: { targetId: true },
  });
  const targetIds = contacts.map((c) => c.targetId);

  const reverseContacts = await prisma.contact.findMany({
    where: {
      tenantId,
      targetId: userId,
      status: 'accepted',
    },
    select: { ownerId: true },
  });
  const ownerIds = reverseContacts.map((c) => c.ownerId);

  const contactIds = Array.from(new Set([...targetIds, ...ownerIds]));
  const payload = isOnline
    ? { userId, isOnline: true }
    : { userId, isOnline: false, lastSeenAt: new Date().toISOString() };

  for (const contactId of contactIds) {
    io.to(`user:${contactId}`).emit('user:presence', payload);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api/src/lib/socket.ts
git commit -m "feat(api): scope socket rooms and presence by tenant"
```

---

### Task 10: Update backend tests

**Files:**
- Modify: `services/api/tests/auth.test.ts`
- Modify: `services/api/tests/contacts.test.ts`
- Modify: `services/api/tests/chats.test.ts`
- Modify: `services/api/tests/socket.test.ts`
- Modify: `services/api/tests/setup.ts`

- [ ] **Step 1: Update cleanup order in setup**

`tests/setup.ts` remains unchanged.

- [ ] **Step 2: Update beforeEach in every test file**

Add these deletions before existing ones in all four test files:

```ts
await prisma.readReceipt.deleteMany();
await prisma.tenantInvite.deleteMany();
await prisma.tenantMembership.deleteMany();
await prisma.tenant.deleteMany();
```

The order for `contacts.test.ts` `beforeEach` should be:

```ts
beforeEach(async () => {
  await prisma.contact.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});
```

For `chats.test.ts` and `socket.test.ts` add `tenantInvite`, `tenantMembership`, `tenant` deletions after message/readReceipt deletions and before `user.deleteMany()`.

- [ ] **Step 3: Add tenantName to register calls**

In all test files, every `request(app).post('/api/auth/register').send({ email, password, displayName })` must include `tenantName: 'Acme'`.

For example in `auth.test.ts`:

```ts
const res = await request(app).post('/api/auth/register').send({
  email: 'alice@example.com',
  password: 'secret123',
  displayName: 'Alice',
  tenantName: 'Acme',
});
```

Update all occurrences across the four files.

- [ ] **Step 4: Add X-Tenant-Id header to tenant-scoped endpoints**

In `contacts.test.ts` and `chats.test.ts`, helper `createUser` currently returns only `{ id, email }`. It must also return the tenant id. Change the helper to:

```ts
async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app).post('/api/auth/register').send({ email, password, displayName, tenantName: displayName });
  const tenantId = res.body.user.tenants[0].tenantId as string;
  return { user: res.body.user as { id: string; email: string }, tenantId, token: res.body.tokens.accessToken as string };
}
```

Then update test calls to use the returned `tenantId` and `token` and set both headers:

```ts
.set('Authorization', `Bearer ${token}`)
.set('X-Tenant-Id', tenantId)
```

Rewrite `contacts.test.ts` fully:

```ts
import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';

const app = createApp();

async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app).post('/api/auth/register').send({ email, password, displayName, tenantName: displayName });
  const tenantId = res.body.user.tenants[0].tenantId as string;
  return { user: res.body.user as { id: string; email: string }, tenantId, token: res.body.tokens.accessToken as string };
}

beforeEach(async () => {
  await prisma.contact.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Contacts', () => {
  it('creates a contact request and accepts it', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');

    // Make bob a member of alice's tenant
    await prisma.tenantMembership.create({
      data: { tenantId: alice.tenantId, userId: bob.user.id, role: 'member' },
    });

    const reqRes = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ targetId: bob.user.id });
    expect(reqRes.status).toBe(201);

    const acceptRes = await request(app)
      .patch(`/api/contacts/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ status: 'accepted' });
    expect(acceptRes.status).toBe(200);

    const chats = await prisma.chat.findMany({ where: { tenantId: alice.tenantId }, include: { members: true } });
    expect(chats.length).toBe(1);
    expect(chats[0].members.map((m) => m.userId).sort()).toEqual([alice.user.id, bob.user.id].sort());
  });

  it('lists contacts', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    await prisma.tenantMembership.create({
      data: { tenantId: alice.tenantId, userId: bob.user.id, role: 'member' },
    });
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ targetId: bob.user.id });

    const listRes = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
  });

  it('rejects adding yourself', async () => {
    const alice = await createUser('alice-self@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ targetId: alice.user.id });
    expect(res.status).toBe(400);
  });

  it('rejects adding non-existent user in tenant', async () => {
    const alice = await createUser('alice-missing@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ targetId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  it('rejects accepting a blocked contact', async () => {
    const alice = await createUser('alice-block@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob-block@example.com', 'secret123', 'Bob');
    await prisma.tenantMembership.create({ data: { tenantId: alice.tenantId, userId: bob.user.id, role: 'member' } });

    const reqRes = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ targetId: bob.user.id });

    await prisma.contact.create({
      data: { tenantId: alice.tenantId, ownerId: bob.user.id, targetId: alice.user.id, status: 'pending' },
    });
    await prisma.contact.update({
      where: { tenantId_ownerId_targetId: { tenantId: alice.tenantId, ownerId: bob.user.id, targetId: alice.user.id } },
      data: { status: 'blocked' },
    });
    const acceptRes = await request(app)
      .patch(`/api/contacts/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ status: 'accepted' });
    expect(acceptRes.status).toBe(403);
  });
});
```

Rewrite `chats.test.ts` fully:

```ts
import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';

const app = createApp();

async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app).post('/api/auth/register').send({ email, password, displayName, tenantName: displayName });
  const tenantId = res.body.user.tenants[0].tenantId as string;
  return { user: res.body.user as { id: string; email: string }, tenantId, token: res.body.tokens.accessToken as string };
}

beforeEach(async () => {
  await prisma.readReceipt.deleteMany();
  await prisma.message.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Chats and messages', () => {
  it('creates a group chat and sends a message', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    await prisma.tenantMembership.create({ data: { tenantId: alice.tenantId, userId: bob.user.id, role: 'member' } });

    const chatRes = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ title: 'Team', memberIds: [bob.user.id] });
    expect(chatRes.status).toBe(201);
    const chatId = chatRes.body.id;

    const msgRes = await request(app)
      .post(`/api/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ content: 'Hello team' });
    expect(msgRes.status).toBe(201);
    expect(msgRes.body.content).toBe('Hello team');

    const listRes = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${bob.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ content: 'Hello team' });
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
  });

  it('marks a message as read', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    await prisma.tenantMembership.create({ data: { tenantId: alice.tenantId, userId: bob.user.id, role: 'member' } });

    const chatRes = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ title: 'Team', memberIds: [bob.user.id] });
    const chatId = chatRes.body.id;

    const msgRes = await request(app)
      .post(`/api/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ content: 'Read me' });

    const readRes = await request(app)
      .post(`/api/chats/messages/${msgRes.body.id}/read`)
      .set('Authorization', `Bearer ${bob.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({});
    expect(readRes.status).toBe(200);
  });

  it('rejects creating a chat with non-existent member', async () => {
    const alice = await createUser('alice-missing-member@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ title: 'Team', memberIds: ['00000000-0000-0000-0000-000000000000'] });
    expect(res.status).toBe(400);
  });
});
```

Update `socket.test.ts` similarly to include `tenantName` in register and `X-Tenant-Id` where needed. It uses socket events; the socket handshake must pass `tenantId`.

- [ ] **Step 5: Run backend tests**

```bash
cd /home/shugar/dev/pulse-chat/services/api && pnpm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api/tests
git commit -m "test(api): update tests for multitenancy"
```

---

### Task 11: Final backend type-check

- [ ] **Step 1: Run type-check**

```bash
cd /home/shugar/dev/pulse-chat/services/api && pnpm exec tsc --noEmit
```

- [ ] **Step 2: Commit any fixes**

If no fixes, no commit needed.

---

## Self-review

1. **Spec coverage:** all routes now enforce tenant isolation; users can belong to multiple tenants; invites enable joining.
2. **Placeholder scan:** no TBD/TODO.
3. **Type consistency:** `TenantRequest.tenantId`, `TenantMembership.role`, `User.tenants` used consistently.

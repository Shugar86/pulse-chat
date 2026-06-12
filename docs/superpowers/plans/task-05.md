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


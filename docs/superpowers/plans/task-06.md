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


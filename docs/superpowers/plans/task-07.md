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


import { createApp, createHttpServer, createIOServer } from '../src/server';
import { setupSocketHandlers } from '../src/lib/socket';
import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import request from 'supertest';
import { io as Client } from 'socket.io-client';

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

afterAll(async () => {
  httpServer.close();
  io.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.$connect();
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

  it('rejects connection with invalid token', (done) => {
    const client = Client(serverAddress, { auth: { token: 'invalid' } });
    client.on('connect_error', () => {
      client.disconnect();
      done();
    });
  });

  it('rejects sending message to chat user is not member of', async () => {
    const alice = await createUser('alice-other@example.com', 'Alice');
    const charlie = await createUser('charlie-other@example.com', 'Charlie');
    const bob = await createUser('bob-other@example.com', 'Bob');
    const chatRes = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${signAccessToken({ userId: alice.id, email: alice.email })}`)
      .send({ title: 'Private', memberIds: [charlie.id] });
    const chatId = chatRes.body.id;

    const bobClient = clientFor(bob.id, bob.email);
    await new Promise<void>((resolve) => bobClient.on('connect', resolve));
    const errorReceived = new Promise<any>((resolve) => bobClient.on('error', resolve));
    bobClient.emit('message:send', { chatId, content: 'intrusion' });
    const err = await errorReceived;
    expect(err.message).toBe('Not a chat member');
    bobClient.disconnect();
  });
});

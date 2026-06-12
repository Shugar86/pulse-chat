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

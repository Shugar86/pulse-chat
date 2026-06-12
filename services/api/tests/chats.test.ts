import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';

const app = createApp();

async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, displayName, tenantName: displayName });
  const tenantId = res.body.user.tenants[0].tenantId as string;
  return {
    user: res.body.user as { id: string; email: string },
    tenantId,
    token: res.body.tokens.accessToken as string,
  };
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
    await prisma.tenantMembership.create({
      data: { tenantId: alice.tenantId, userId: bob.user.id, role: 'member' },
    });

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
      .set('X-Tenant-Id', alice.tenantId);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
  });

  it('marks a message as read', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    await prisma.tenantMembership.create({
      data: { tenantId: alice.tenantId, userId: bob.user.id, role: 'member' },
    });

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
      .set('X-Tenant-Id', alice.tenantId);
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

  it('does not show chats from another tenant', async () => {
    const alice = await createUser('alice-isolated@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob-isolated@example.com', 'secret123', 'Bob');
    await prisma.tenantMembership.create({
      data: { tenantId: alice.tenantId, userId: bob.user.id, role: 'member' },
    });

    const chatRes = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ title: 'Secret', memberIds: [bob.user.id] });
    expect(chatRes.status).toBe(201);

    const otherTenantList = await request(app)
      .get('/api/chats')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', bob.tenantId);
    expect(otherTenantList.status).toBe(403);
  });
});

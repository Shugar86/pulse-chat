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
    await prisma.tenantMembership.create({
      data: { tenantId: alice.tenantId, userId: bob.user.id, role: 'member' },
    });

    const reqRes = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ targetId: bob.user.id });

    await prisma.contact.create({
      data: { tenantId: alice.tenantId, ownerId: bob.user.id, targetId: alice.user.id, status: 'pending' },
    });
    await prisma.contact.update({
      where: {
        tenantId_ownerId_targetId: {
          tenantId: alice.tenantId,
          ownerId: bob.user.id,
          targetId: alice.user.id,
        },
      },
      data: { status: 'blocked' },
    });
    const acceptRes = await request(app)
      .patch(`/api/contacts/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ status: 'accepted' });
    expect(acceptRes.status).toBe(403);
  });

  it('does not show contacts from another tenant', async () => {
    const alice = await createUser('alice-isolated@example.com', 'secret123', 'Alice');
    const bob = await createUser('bob-isolated@example.com', 'secret123', 'Bob');
    const charlie = await createUser('charlie-isolated@example.com', 'secret123', 'Charlie');

    // bob is in alice's tenant
    await prisma.tenantMembership.create({
      data: { tenantId: alice.tenantId, userId: bob.user.id, role: 'member' },
    });
    // charlie is in his own tenant (created on register)
    const charlieTenantId = charlie.tenantId;

    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ targetId: bob.user.id });

    const otherTenantList = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', charlieTenantId);
    expect(otherTenantList.status).toBe(403);
  });
});

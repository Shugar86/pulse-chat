import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';

const app = createApp();

async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, displayName, tenantName: displayName });
  return {
    user: res.body.user as { id: string; email: string },
    tenantId: res.body.user.tenants[0].tenantId as string,
    token: res.body.tokens.accessToken as string,
  };
}

beforeEach(async () => {
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Tenants', () => {
  it('lists user memberships', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .get('/api/tenants')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].tenant.name).toBe('Alice');
  });

  it('creates a new tenant', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .post('/api/tenants')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'New Company' });
    expect(res.status).toBe(201);
    expect(res.body.tenant.name).toBe('New Company');
    expect(res.body.role).toBe('owner');
  });

  it('joins a tenant by invite code', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const inviteRes = await request(app)
      .post(`/api/tenants/${alice.tenantId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(inviteRes.status).toBe(201);

    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    const joinRes = await request(app)
      .post('/api/tenants/join')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ code: inviteRes.body.code });
    expect(joinRes.status).toBe(201);
    expect(joinRes.body.tenantId).toBe(alice.tenantId);
  });

  it('returns 404 for invalid invite code', async () => {
    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    const res = await request(app)
      .post('/api/tenants/join')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ code: 'INVALID' });
    expect(res.status).toBe(404);
  });

  it('returns 410 for expired invite code', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const invite = await prisma.tenantInvite.create({
      data: {
        tenantId: alice.tenantId,
        code: 'EXPIRED',
        createdBy: alice.user.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    const res = await request(app)
      .post('/api/tenants/join')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ code: invite.code });
    expect(res.status).toBe(410);
  });

  it('returns 409 when user already is a member', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const inviteRes = await request(app)
      .post(`/api/tenants/${alice.tenantId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`);

    const res = await request(app)
      .post('/api/tenants/join')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ code: inviteRes.body.code });
    expect(res.status).toBe(409);
  });

  it('returns 403 when non-admin tries to create invite', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const inviteRes = await request(app)
      .post(`/api/tenants/${alice.tenantId}/invites`)
      .set('Authorization', `Bearer ${alice.token}`);
    const code = inviteRes.body.code;

    const bob = await createUser('bob@example.com', 'secret123', 'Bob');
    await request(app)
      .post('/api/tenants/join')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ code });

    const res = await request(app)
      .post(`/api/tenants/${alice.tenantId}/invites`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(res.status).toBe(403);
  });
});

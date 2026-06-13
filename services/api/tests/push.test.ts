import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';

const app = createApp();

async function createUser(email: string, password: string, displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, displayName, tenantName: displayName });
  return {
    user: res.body.user,
    tenantId: res.body.user.tenants[0].tenantId,
    token: res.body.tokens.accessToken,
  };
}

beforeEach(async () => {
  await prisma.pushToken.deleteMany();
  await prisma.vpnPeer.deleteMany();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Push tokens', () => {
  it('registers a push token', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .post('/api/push/register')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId)
      .send({ token: 'fcm-token-123', platform: 'android' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const stored = await prisma.pushToken.findUnique({ where: { token: 'fcm-token-123' } });
    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(alice.user.id);
  });
});

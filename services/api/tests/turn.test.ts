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
  await prisma.vpnPeer.deleteMany();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('TURN credentials', () => {
  it('returns ice servers for authenticated user', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .get('/api/turn/credentials')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId);
    expect(res.status).toBe(200);
    expect(res.body.iceServers).toBeDefined();
    expect(res.body.iceServers.length).toBeGreaterThanOrEqual(3);
    const turn = res.body.iceServers.find((s: any) => s.urls.startsWith('turn:'));
    expect(turn.username).toBeDefined();
    expect(turn.credential).toBeDefined();
  });
});

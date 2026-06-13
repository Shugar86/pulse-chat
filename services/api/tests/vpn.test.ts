import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
  await prisma.vpnPeer.deleteMany();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('VPN', () => {
  let syncDir: string;

  beforeEach(() => {
    syncDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpn-test-'));
    process.env.WG_SYNC_DIR = syncDir;
  });

  afterEach(() => {
    fs.rmSync(syncDir, { recursive: true, force: true });
  });

  it('creates a peer config', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const res = await request(app)
      .post('/api/vpn/config')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId);
    expect(res.status).toBe(201);
    expect(res.body.config).toContain('[Interface]');
    expect(res.body.config).toContain('[Peer]');
    expect(res.body.publicKey).toBeDefined();
    expect(res.body.address).toMatch(/^10\.200\.0\.\d+\/32$/);
  });

  it('returns existing peer config on second call', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    const first = await request(app)
      .post('/api/vpn/config')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId);
    const second = await request(app)
      .post('/api/vpn/config')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
  });

  it('gets peer config', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    await request(app)
      .post('/api/vpn/config')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId);
    const res = await request(app)
      .get('/api/vpn/config')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId);
    expect(res.status).toBe(200);
    expect(res.body.config).toContain('[Interface]');
  });

  it('deletes peer config', async () => {
    const alice = await createUser('alice@example.com', 'secret123', 'Alice');
    await request(app)
      .post('/api/vpn/config')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId);
    const del = await request(app)
      .delete('/api/vpn/config')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId);
    expect(del.status).toBe(204);
    const get = await request(app)
      .get('/api/vpn/config')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('X-Tenant-Id', alice.tenantId);
    expect(get.status).toBe(404);
  });
});

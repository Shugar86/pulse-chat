import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';
import { config } from '../src/config';
import { resetRateLimitWindows } from '../src/middleware/rateLimit';

const app = createApp();

beforeEach(async () => {
  resetRateLimitWindows();
  await prisma.tenantInvite.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('creates a user, tenant and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'secret123',
      displayName: 'Alice',
      tenantName: 'Acme',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.tenants.length).toBe(1);
    expect(res.body.user.tenants[0].role).toBe('owner');
    expect(res.body.tokens.accessToken).toBeDefined();
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'secret123',
      displayName: 'Alice',
      tenantName: 'Acme',
    });
    const res = await request(app).post('/api/auth/register').send({
      email: 'Alice@Example.com',
      password: 'secret123',
      displayName: 'Alice2',
      tenantName: 'Acme2',
    });
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'secret123',
      displayName: 'Alice',
      tenantName: 'Acme',
    });
    expect(res.status).toBe(400);
    expect(res.body.fields).toBeDefined();
    expect(res.body.fields.some((f: any) => f.field === 'email')).toBe(true);
  });

  it('returns 400 for short password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'short',
      displayName: 'Alice',
      tenantName: 'Acme',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing tenant name', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'secret123',
      displayName: 'Alice',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      password: 'secret123',
      displayName: 'Bob',
      tenantName: 'Acme',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'BOB@EXAMPLE.COM',
      password: 'secret123',
    });
    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.user.tenants.length).toBe(1);
  });

  it('rejects invalid password', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      password: 'secret123',
      displayName: 'Bob',
      tenantName: 'Acme',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });

  it('rejects non-existent email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(401);
  });

  it('returns 429 after too many failed login attempts', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/auth/login').send({
        email: 'brute@example.com',
        password: 'wrong',
      });
    }
    const res = await request(app).post('/api/auth/login').send({
      email: 'brute@example.com',
      password: 'wrong',
    });
    expect(res.status).toBe(429);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns a new access token', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      email: 'carol@example.com',
      password: 'secret123',
      displayName: 'Carol',
      tenantName: 'Acme',
    });
    const refreshToken = registerRes.body.tokens.refreshToken;
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects invalid refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'invalid' });
    expect(res.status).toBe(401);
  });
});

describe('JWT token contents', () => {
  it('includes userId and email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'dave@example.com',
      password: 'secret123',
      displayName: 'Dave',
      tenantName: 'Acme',
    });
    const decoded = jwt.verify(res.body.tokens.accessToken, config.jwtAccessSecret) as { userId: string; email: string };
    expect(decoded.email).toBe('dave@example.com');
    expect(decoded.userId).toBe(res.body.user.id);
  });
});

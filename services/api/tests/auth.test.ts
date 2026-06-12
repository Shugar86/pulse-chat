import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/lib/prisma';

const app = createApp();

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'secret123',
      displayName: 'Alice',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.tokens.accessToken).toBeDefined();
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'secret123',
      displayName: 'Alice',
    });
    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'secret123',
      displayName: 'Alice2',
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      password: 'secret123',
      displayName: 'Bob',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeDefined();
  });

  it('rejects invalid password', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      password: 'secret123',
      displayName: 'Bob',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'wrong',
    });
    expect(res.status).toBe(401);
  });
});

### Task 4: Auth module + tests

**Files:**
- Create: `services/api/src/lib/jwt.ts`
- Create: `services/api/src/middleware/auth.ts`
- Create: `services/api/src/routes/auth.ts`
- Modify: `services/api/src/routes/index.ts`
- Create: `services/api/tests/auth.test.ts`

- [ ] **Step 1: Write `services/api/src/lib/jwt.ts`**

```typescript
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export type TokenPayload = { userId: string; email: string };

export function signAccessToken(payload: TokenPayload) {
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.accessTokenTtl });
}

export function signRefreshToken(payload: TokenPayload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.refreshTokenTtl });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtAccessSecret) as TokenPayload;
}
```

- [ ] **Step 2: Write `services/api/src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../lib/jwt.js';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

- [ ] **Step 3: Write `services/api/src/routes/auth.ts`**

```typescript
import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signAccessToken, signRefreshToken } from '../lib/jwt.js';
import { ApiError } from '../middleware/error.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ApiError(409, 'Email already in use');
    const passwordHash = await argon2.hash(data.password);
    const user = await prisma.user.create({
      data: { email: data.email, passwordHash, displayName: data.displayName },
      select: { id: true, email: true, displayName: true, preferredLanguage: true },
    });
    const tokens = {
      accessToken: signAccessToken({ userId: user.id, email: user.email }),
      refreshToken: signRefreshToken({ userId: user.id, email: user.email }),
    };
    res.status(201).json({ user, tokens });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw new ApiError(401, 'Invalid credentials');
    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) throw new ApiError(401, 'Invalid credentials');
    const tokens = {
      accessToken: signAccessToken({ userId: user.id, email: user.email }),
      refreshToken: signRefreshToken({ userId: user.id, email: user.email }),
    };
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        preferredLanguage: user.preferredLanguage,
      },
      tokens,
    });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Modify `services/api/src/routes/index.ts`**

```typescript
import { Router } from 'express';
import { authRouter } from './auth.js';

export const routes = Router();

routes.get('/health', (_req, res) => res.json({ ok: true }));
routes.use('/auth', authRouter);
```

- [ ] **Step 5: Write failing test `services/api/tests/auth.test.ts`**

```typescript
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
```

- [ ] **Step 6: Run migrations and tests**

Ensure Postgres is running:

```bash
cd /home/shugar/dev/pulse-chat
docker compose up -d
```

Then migrate:

```bash
cd services/api
cp ../../.env.example .env
# Edit .env DATABASE_URL if needed
pnpm exec prisma migrate dev --name init
```

Run tests:

```bash
pnpm test
```

Expected: all auth tests pass.

- [ ] **Step 7: Commit**

```bash
cd /home/shugar/dev/pulse-chat
git add services/api
git commit -m "feat(api): auth module with register/login and tests"
```

---


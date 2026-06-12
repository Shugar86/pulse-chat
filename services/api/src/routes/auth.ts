import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, TokenPayload } from '../lib/jwt.js';
import { ApiError } from '../middleware/error.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
  tenantName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50) || 'tenant';
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let counter = 1;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

const userSelect = { id: true, email: true, displayName: true, preferredLanguage: true, avatarUrl: true, lastSeenAt: true };
const tenantSelect = { id: true, name: true, slug: true };

function mapMembership(m: any) {
  return { id: m.id, tenantId: m.tenantId, userId: m.userId, role: m.role, tenant: m.tenant };
}

export const authRouter: Router = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, 'Email already in use');

    const passwordHash = await argon2.hash(data.password);
    const slug = await uniqueSlug(data.tenantName);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash, displayName: data.displayName }, select: userSelect });
      const tenant = await tx.tenant.create({ data: { name: data.tenantName, slug }, select: tenantSelect });
      const membership = await tx.tenantMembership.create({
        data: { tenantId: tenant.id, userId: user.id, role: 'owner' },
        include: { tenant: { select: tenantSelect } },
      });
      return { user, membership };
    });

    const tokens = {
      accessToken: signAccessToken({ userId: result.user.id, email: result.user.email }),
      refreshToken: signRefreshToken({ userId: result.user.id, email: result.user.email }),
    };
    res.status(201).json({
      user: {
        ...result.user,
        lastSeenAt: result.user.lastSeenAt.toISOString(),
        tenants: [mapMembership(result.membership)],
      },
      tokens,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(401, 'Invalid credentials');
    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) throw new ApiError(401, 'Invalid credentials');

    const memberships = await prisma.tenantMembership.findMany({
      where: { userId: user.id },
      include: { tenant: { select: tenantSelect } },
    });

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
        avatarUrl: user.avatarUrl,
        lastSeenAt: user.lastSeenAt.toISOString(),
        tenants: memberships.map(mapMembership),
      },
      tokens,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, 'Invalid refresh token');
    }
    const accessToken = signAccessToken({ userId: payload.userId, email: payload.email });
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireTenant, TenantRequest } from '../middleware/tenant.js';

const updateProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  preferredLanguage: z.enum(['ru', 'en']).optional(),
});

const tenantSelect = { id: true, name: true, slug: true };

function mapMembership(m: any) {
  return { id: m.id, tenantId: m.tenantId, userId: m.userId, role: m.role, tenant: m.tenant };
}

export const usersRouter: Router = Router();

usersRouter.use(requireAuth);

usersRouter.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        preferredLanguage: true,
        lastSeenAt: true,
        memberships: { include: { tenant: { select: tenantSelect } } },
      },
    });
    res.json({
      ...user,
      lastSeenAt: user.lastSeenAt.toISOString(),
      tenants: user.memberships.map(mapMembership),
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/me', async (req: AuthRequest, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        preferredLanguage: true,
        lastSeenAt: true,
        memberships: { include: { tenant: { select: tenantSelect } } },
      },
    });
    res.json({
      ...user,
      lastSeenAt: user.lastSeenAt.toISOString(),
      tenants: user.memberships.map(mapMembership),
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/search', requireTenant, async (req: TenantRequest, res, next) => {
  try {
    const q = z.string().min(1).parse(req.query.q);
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user!.userId },
        memberships: { some: { tenantId: req.tenantId } },
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

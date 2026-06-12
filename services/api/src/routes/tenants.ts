import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { parseOrThrow } from '../lib/validation.js';

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

function generateCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

const tenantSelect = { id: true, name: true, slug: true };

function mapMembership(m: any) {
  return { id: m.id, tenantId: m.tenantId, userId: m.userId, role: m.role, tenant: m.tenant };
}

export const tenantsRouter: Router = Router();

tenantsRouter.use(requireAuth);

tenantsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const memberships = await prisma.tenantMembership.findMany({
      where: { userId: req.user!.userId },
      include: { tenant: { select: tenantSelect } },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(memberships.map(mapMembership));
  } catch (err) {
    next(err);
  }
});

tenantsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { name } = parseOrThrow(z.object({ name: z.string().min(1) }), req.body);
    const slug = await uniqueSlug(name);
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name, slug }, select: tenantSelect });
      const membership = await tx.tenantMembership.create({
        data: { tenantId: tenant.id, userId: req.user!.userId, role: 'owner' },
        include: { tenant: { select: tenantSelect } },
      });
      return membership;
    });
    res.status(201).json(mapMembership(result));
  } catch (err) {
    next(err);
  }
});

tenantsRouter.post('/join', async (req: AuthRequest, res, next) => {
  try {
    const { code } = parseOrThrow(z.object({ code: z.string().min(1) }), req.body);
    const invite = await prisma.tenantInvite.findUnique({ where: { code: code.toUpperCase() } });
    if (!invite) throw new ApiError(404, 'Invite not found');
    if (invite.expiresAt < new Date()) throw new ApiError(410, 'Invite expired');

    const existing = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: invite.tenantId, userId: req.user!.userId } },
    });
    if (existing) throw new ApiError(409, 'Already a member');

    const membership = await prisma.tenantMembership.create({
      data: { tenantId: invite.tenantId, userId: req.user!.userId, role: 'member' },
      include: { tenant: { select: tenantSelect } },
    });
    res.status(201).json(mapMembership(membership));
  } catch (err) {
    next(err);
  }
});

tenantsRouter.post('/:id/invites', async (req: AuthRequest, res, next) => {
  try {
    const tenantId = parseOrThrow(z.string().uuid(), req.params.id);
    const membership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: req.user!.userId } },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      throw new ApiError(403, 'Only owner or admin can invite');
    }

    const code = generateCode();
    const invite = await prisma.tenantInvite.create({
      data: {
        tenantId,
        code,
        createdBy: req.user!.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    res.status(201).json({ code: invite.code });
  } catch (err) {
    next(err);
  }
});

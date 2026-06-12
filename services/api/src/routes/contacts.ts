import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireTenant, TenantRequest } from '../middleware/tenant.js';
import { ApiError } from '../middleware/error.js';

const contactActionSchema = z.object({
  status: z.enum(['accepted', 'blocked', 'removed']),
});

const targetSelect = { id: true, email: true, displayName: true, avatarUrl: true, lastSeenAt: true };

export const contactsRouter: Router = Router();

contactsRouter.use(requireAuth, requireTenant);

contactsRouter.get('/', async (req: TenantRequest, res, next) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { tenantId: req.tenantId, ownerId: req.user!.userId, status: { not: 'removed' } },
      include: { target: { select: targetSelect } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(contacts);
  } catch (err) {
    next(err);
  }
});

contactsRouter.post('/', async (req: TenantRequest, res, next) => {
  try {
    const { targetId } = z.object({ targetId: z.string().uuid() }).parse(req.body);
    if (targetId === req.user!.userId) throw new ApiError(400, 'Cannot add yourself');

    const targetMembership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: req.tenantId!, userId: targetId } },
    });
    if (!targetMembership) throw new ApiError(404, 'Target user not found in tenant');

    const existing = await prisma.contact.findUnique({
      where: { tenantId_ownerId_targetId: { tenantId: req.tenantId!, ownerId: req.user!.userId, targetId } },
    });
    if (existing) throw new ApiError(409, 'Contact request already exists');

    const contact = await prisma.contact.create({
      data: { tenantId: req.tenantId!, ownerId: req.user!.userId, targetId },
      include: { target: { select: targetSelect } },
    });
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

contactsRouter.patch('/:id', async (req: TenantRequest, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { status } = contactActionSchema.parse(req.body);

    const contact = await prisma.contact.findFirst({
      where: { id, tenantId: req.tenantId, ownerId: req.user!.userId },
    });
    if (!contact) throw new ApiError(404, 'Contact not found');

    if (status === 'accepted') {
      const other = await prisma.contact.findUnique({
        where: { tenantId_ownerId_targetId: { tenantId: req.tenantId!, ownerId: contact.targetId, targetId: contact.ownerId } },
      });
      if (other?.status === 'blocked') {
        throw new ApiError(403, 'Contact is blocked');
      }
    }

    if (status === 'removed') {
      await prisma.contact.delete({ where: { id } });
      return res.status(204).send();
    }

    const updated = await prisma.contact.update({
      where: { id },
      data: { status },
      include: { target: { select: targetSelect } },
    });

    if (status === 'accepted') {
      const other = await prisma.contact.findUnique({
        where: { tenantId_ownerId_targetId: { tenantId: req.tenantId!, ownerId: contact.targetId, targetId: contact.ownerId } },
      });
      if (!other) {
        await prisma.contact.create({
          data: { tenantId: req.tenantId!, ownerId: contact.targetId, targetId: contact.ownerId, status: 'accepted' },
        });
      } else if (other.status === 'pending') {
        await prisma.contact.update({ where: { id: other.id }, data: { status: 'accepted' } });
      }
      await ensureDirectChat(req.tenantId!, contact.ownerId, contact.targetId);
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

async function ensureDirectChat(tenantId: string, userA: string, userB: string) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT c.id FROM "Chat" c
    JOIN "ChatMember" m1 ON c.id = m1."chatId" AND m1."userId" = ${userA}
    JOIN "ChatMember" m2 ON c.id = m2."chatId" AND m2."userId" = ${userB}
    WHERE c.type = 'direct' AND c."tenantId" = ${tenantId}
    LIMIT 1
  `;
  if (existing.length > 0) {
    return prisma.chat.findUnique({ where: { id: existing[0].id } });
  }

  return prisma.chat.create({
    data: {
      tenantId,
      type: 'direct',
      members: { create: [{ userId: userA }, { userId: userB }] },
    },
  });
}

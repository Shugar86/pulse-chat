import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireTenant, TenantRequest } from '../middleware/tenant.js';
import { parseOrThrow } from '../lib/validation.js';
import { prisma } from '../lib/prisma.js';

export const pushRouter: Router = Router();
pushRouter.use(requireAuth, requireTenant);

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['android', 'ios']),
});

pushRouter.post('/register', async (req: TenantRequest, res, next) => {
  try {
    const { token, platform } = parseOrThrow(registerSchema, req.body);
    await prisma.pushToken.upsert({
      where: { token },
      create: {
        token,
        platform,
        userId: req.user!.userId,
        tenantId: req.tenantId!,
      },
      update: {
        userId: req.user!.userId,
        tenantId: req.tenantId!,
        platform,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

pushRouter.delete('/unregister', async (req: TenantRequest, res, next) => {
  try {
    const { token } = parseOrThrow(z.object({ token: z.string().min(1) }), req.body);
    await prisma.pushToken.deleteMany({
      where: { token, userId: req.user!.userId },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

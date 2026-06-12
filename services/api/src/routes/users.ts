import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const updateProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  preferredLanguage: z.enum(['ru', 'en']).optional(),
});

export const usersRouter: Router = Router();

usersRouter.use(requireAuth);

usersRouter.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.userId },
      select: { id: true, email: true, displayName: true, avatarUrl: true, preferredLanguage: true, lastSeenAt: true },
    });
    res.json(user);
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
      select: { id: true, email: true, displayName: true, avatarUrl: true, preferredLanguage: true, lastSeenAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/search', async (req: AuthRequest, res, next) => {
  try {
    const q = z.string().min(1).parse(req.query.q);
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
        id: { not: req.user!.userId },
      },
      take: 20,
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

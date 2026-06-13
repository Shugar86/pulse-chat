import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export const healthRouter: Router = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

healthRouter.get('/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }
  if (redis) {
    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }
  } else {
    checks.redis = 'ok';
  }
  const ok = Object.values(checks).every((v) => v === 'ok');
  res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'not_ready', checks });
});

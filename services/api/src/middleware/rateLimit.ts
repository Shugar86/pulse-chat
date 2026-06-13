import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis.js';

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export function resetRateLimitWindows() {
  windows.clear();
}

export function rateLimit(options: { windowMs: number; max: number; keyPrefix?: string }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${options.keyPrefix || 'rl'}:${req.ip}`;

    if (redis) {
      try {
        const multi = redis.multi();
        multi.incr(key);
        multi.pexpire(key, options.windowMs);
        const results = await multi.exec();
        const count = results?.[0]?.[1] as number;
        if (count > options.max) {
          return res.status(429).json({ error: 'Too many requests, please try again later' });
        }
        return next();
      } catch {
        // Redis unavailable — fall through to in-memory
      }
    }

    // In-memory fallback
    const now = Date.now();
    let window = windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + options.windowMs };
      windows.set(key, window);
    }
    window.count++;
    if (window.count > options.max) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }
    next();
  };
}

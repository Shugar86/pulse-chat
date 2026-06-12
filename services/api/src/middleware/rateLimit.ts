import { Request, Response, NextFunction } from 'express';

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export function resetRateLimitWindows() {
  windows.clear();
}

export function rateLimit(options: { windowMs: number; max: number; keyPrefix?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${options.keyPrefix || 'rl'}:${req.ip}`;
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

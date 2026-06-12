import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      JSON.stringify({
        requestId: id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        ip: req.ip,
      })
    );
  });

  next();
}

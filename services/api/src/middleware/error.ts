import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../lib/validation.js';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, fields: err.errors });
  }
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: 'Validation error', issues: err.issues });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

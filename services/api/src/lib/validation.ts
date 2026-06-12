import { ZodError, ZodSchema } from 'zod';

export interface FieldError {
  field: string;
  message: string;
}

export class ValidationError extends Error {
  constructor(public errors: FieldError[]) {
    super('Validation failed');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export function formatZodError(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'general',
    message: issue.message,
  }));
}

export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ValidationError(formatZodError(err));
    }
    throw err;
  }
}

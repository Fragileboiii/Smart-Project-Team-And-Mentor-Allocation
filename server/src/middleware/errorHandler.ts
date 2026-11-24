import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.flatten().fieldErrors,
    });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    console.error('[Error]', err);
  }

  return res.status(status).json({ error: message });
}

export class AppError extends Error {
  constructor(public message: string, public status: number = 400) {
    super(message);
    this.name = 'AppError';
  }
}

import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import { isProd } from '../config.js';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'المسار غير موجود', code: 'not_found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  const message = err instanceof Error ? err.message : 'خطأ غير معروف';
  log.error('خطأ غير معالج', err);
  res.status(500).json({ error: isProd ? 'خطأ داخلي في الخادم' : message, code: 'internal' });
}

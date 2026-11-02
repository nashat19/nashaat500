import type { NextFunction, Request, Response } from 'express';
import { verifyToken, type Role, type TokenPayload } from '../lib/jwt.js';
import { unauthorized } from '../lib/errors.js';
import { db } from '../db/index.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

function extract(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = (req.cookies as Record<string, string> | undefined)?.token;
  if (cookie) return cookie;
  const q = req.query.token;
  return typeof q === 'string' ? q : null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extract(req);
  if (!token) return next(unauthorized());
  const payload = verifyToken(token);
  if (!payload) return next(unauthorized('جلسة منتهية أو غير صالحة'));

  const row = db.prepare('SELECT active, role FROM users WHERE id = ?').get(payload.sub) as
    | { active: number; role: Role }
    | undefined;
  if (!row || !row.active) return next(unauthorized('الحساب معطّل'));

  req.user = { ...payload, role: row.role };
  next();
}

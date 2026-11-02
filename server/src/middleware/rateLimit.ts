import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors.js';

interface Bucket { count: number; reset: number }

export function rateLimit(opts: { windowMs: number; max: number; key?: (req: Request) => string }) {
  const buckets = new Map<string, Bucket>();

  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  }, 60_000).unref();

  return (req: Request, _res: Response, next: NextFunction) => {
    const key = opts.key?.(req) ?? req.ip ?? 'anon';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.reset < now) {
      bucket = { count: 0, reset: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > opts.max) {
      return next(new HttpError(429, 'عدد الطلبات كبير — حاول لاحقاً', 'rate_limited'));
    }
    next();
  };
}

export const apiLimiter = rateLimit({ windowMs: 60_000, max: 300 });
export const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, key: (r) => `auth:${r.ip}` });

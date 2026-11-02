import { badRequest } from './errors.js';

export function str(value: unknown, field: string, opts: { min?: number; max?: number; optional?: boolean } = {}): string {
  if (value === undefined || value === null || value === '') {
    if (opts.optional) return '';
    throw badRequest(`الحقل "${field}" مطلوب`);
  }
  if (typeof value !== 'string') throw badRequest(`الحقل "${field}" يجب أن يكون نصاً`);
  const v = value.trim();
  if (opts.min !== undefined && v.length < opts.min) throw badRequest(`الحقل "${field}" أقصر من ${opts.min} حرف`);
  if (opts.max !== undefined && v.length > opts.max) throw badRequest(`الحقل "${field}" أطول من ${opts.max} حرف`);
  return v;
}

export function num(value: unknown, field: string, opts: { min?: number; max?: number; optional?: boolean } = {}): number {
  if (value === undefined || value === null || value === '') {
    if (opts.optional) return 0;
    throw badRequest(`الحقل "${field}" مطلوب`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest(`الحقل "${field}" يجب أن يكون رقماً`);
  if (opts.min !== undefined && n < opts.min) throw badRequest(`الحقل "${field}" أصغر من ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) throw badRequest(`الحقل "${field}" أكبر من ${opts.max}`);
  return n;
}

export function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  const v = str(value, field);
  if (!allowed.includes(v as T)) throw badRequest(`قيمة "${field}" غير مدعومة`);
  return v as T;
}

export function id(value: unknown, field = 'id'): number {
  return num(value, field, { min: 1 });
}

export function email(value: unknown): string {
  const v = str(value, 'email', { max: 190 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) throw badRequest('بريد إلكتروني غير صالح');
  return v;
}

export function idList(value: unknown, field = 'ids'): number[] {
  if (!Array.isArray(value) || value.length === 0) throw badRequest(`الحقل "${field}" يجب أن يكون قائمة غير فارغة`);
  return [...new Set(value.map((v) => id(v, field)))];
}

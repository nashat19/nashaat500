import type { NextFunction, Request, Response } from 'express';
import { forbidden } from '../lib/errors.js';
import type { Role } from '../lib/jwt.js';

const RANK: Record<Role, number> = { viewer: 1, agent: 2, manager: 3, admin: 4 };

export const atLeast = (min: Role) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(forbidden());
  if (RANK[req.user.role] < RANK[min]) return next(forbidden(`يتطلب دور ${min} أو أعلى`));
  next();
};

export const isAdmin = atLeast('admin');
export const isManager = atLeast('manager');
export const isAgent = atLeast('agent');

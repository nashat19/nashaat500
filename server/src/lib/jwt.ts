import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export type Role = 'admin' | 'manager' | 'agent' | 'viewer';

export interface TokenPayload {
  sub: number;
  email: string;
  role: Role;
  name: string;
}

export const signToken = (p: TokenPayload) =>
  jwt.sign(p, config.jwtSecret, { expiresIn: '7d', issuer: 'loansocial' });

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { issuer: 'loansocial' });
    if (typeof decoded === 'string') return null;
    return decoded as unknown as TokenPayload;
  } catch {
    return null;
  }
}

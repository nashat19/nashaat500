import { Router } from 'express';
import { db, audit } from '../db/index.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { signToken, type Role } from '../lib/jwt.js';
import { email as parseEmail, str } from '../lib/validate.js';
import { unauthorized } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { isProd } from '../config.js';

const router = Router();

const COOKIE = { httpOnly: true, sameSite: 'lax' as const, secure: isProd, maxAge: 7 * 86_400_000, path: '/' };

router.post('/login', authLimiter, (req, res, next) => {
  try {
    const mail = parseEmail(req.body?.email);
    const password = str(req.body?.password, 'password', { min: 6, max: 200 });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(mail) as
      | { id: number; email: string; name: string; role: Role; password_hash: string; active: number }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) throw unauthorized('بيانات الدخول غير صحيحة');
    if (!user.active) throw unauthorized('الحساب معطّل');

    const token = signToken({ sub: user.id, email: user.email, role: user.role, name: user.name });
    res.cookie('token', token, COOKIE);
    audit(user.id, 'auth.login', 'user', user.id, {}, req.ip);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, (req, res) => {
  res.clearCookie('token', { path: '/' });
  if (req.user) audit(req.user.sub, 'auth.logout', 'user', req.user.sub, {}, req.ip);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, color FROM users WHERE id = ?').get(req.user!.sub);
  res.json({ user });
});

router.post('/password', requireAuth, (req, res, next) => {
  try {
    const current = str(req.body?.current, 'current', { min: 6 });
    const next_ = str(req.body?.next, 'next', { min: 8, max: 200 });
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.sub) as { password_hash: string };
    if (!verifyPassword(current, row.password_hash)) throw unauthorized('كلمة المرور الحالية خاطئة');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next_), req.user!.sub);
    audit(req.user!.sub, 'auth.password', 'user', req.user!.sub, {}, req.ip);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

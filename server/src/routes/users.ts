import { Router } from 'express';
import { db, audit } from '../db/index.js';
import { hashPassword } from '../lib/crypto.js';
import { email as parseEmail, oneOf, str, id } from '../lib/validate.js';
import { conflict, notFound, badRequest } from '../lib/errors.js';
import { isAdmin } from '../middleware/rbac.js';

const router = Router();
const ROLES = ['admin', 'manager', 'agent', 'viewer'] as const;

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, email, name, role, color, active, created_at FROM users ORDER BY created_at ASC').all();
  res.json({ rows });
});

router.post('/', isAdmin, (req, res, next) => {
  try {
    const mail = parseEmail(req.body?.email);
    const name = str(req.body?.name, 'name', { min: 2, max: 80 });
    const password = str(req.body?.password, 'password', { min: 8, max: 200 });
    const role = oneOf(req.body?.role ?? 'agent', 'role', ROLES);
    const color = str(req.body?.color ?? '#2563eb', 'color', { max: 9 });

    if (db.prepare('SELECT id FROM users WHERE email = ?').get(mail)) throw conflict('البريد مستخدم مسبقاً');

    const info = db.prepare('INSERT INTO users (email, name, password_hash, role, color) VALUES (?,?,?,?,?)').run(
      mail, name, hashPassword(password), role, color,
    );
    const newId = Number(info.lastInsertRowid);
    audit(req.user!.sub, 'user.create', 'user', newId, { role }, req.ip);
    res.status(201).json({ id: newId });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', isAdmin, (req, res, next) => {
  try {
    const targetId = id(req.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as Record<string, unknown> | undefined;
    if (!user) throw notFound('المستخدم غير موجود');

    const role = req.body?.role ? oneOf(req.body.role, 'role', ROLES) : String(user.role);
    const active = req.body?.active === undefined ? Number(user.active) : req.body.active ? 1 : 0;
    const name = req.body?.name ? str(req.body.name, 'name', { min: 2, max: 80 }) : String(user.name);
    const color = req.body?.color ? str(req.body.color, 'color', { max: 9 }) : String(user.color);

    if (targetId === req.user!.sub && active === 0) throw badRequest('لا يمكنك تعطيل حسابك');
    if (targetId === req.user!.sub && role !== 'admin') {
      const admins = (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1").get() as { c: number }).c;
      if (admins <= 1) throw badRequest('يجب بقاء مدير واحد على الأقل');
    }

    db.prepare('UPDATE users SET name = ?, role = ?, color = ?, active = ? WHERE id = ?').run(name, role, color, active, targetId);
    if (req.body?.password) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(str(req.body.password, 'password', { min: 8 })), targetId);
    }
    audit(req.user!.sub, 'user.update', 'user', targetId, { role, active }, req.ip);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', isAdmin, (req, res, next) => {
  try {
    const targetId = id(req.params.id);
    if (targetId === req.user!.sub) throw badRequest('لا يمكنك حذف حسابك');
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    audit(req.user!.sub, 'user.delete', 'user', targetId, {}, req.ip);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

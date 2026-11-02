import { Router } from 'express';
import { db, audit } from '../db/index.js';
import { id, str } from '../lib/validate.js';
import { isAgent, isManager } from '../middleware/rbac.js';
import { notFound } from '../lib/errors.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ rows: db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all() });
});

router.post('/', isAgent, (req, res, next) => {
  try {
    const info = db
      .prepare('INSERT INTO templates (name, category, body, created_by) VALUES (?,?,?,?)')
      .run(
        str(req.body?.name, 'name', { min: 2, max: 120 }),
        str(req.body?.category ?? 'عام', 'category', { max: 60, optional: true }),
        str(req.body?.body, 'body', { min: 1, max: 4000 }),
        req.user!.sub,
      );
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', isManager, (req, res, next) => {
  try {
    const targetId = id(req.params.id);
    if (!db.prepare('SELECT id FROM templates WHERE id = ?').get(targetId)) throw notFound('القالب غير موجود');
    db.prepare('DELETE FROM templates WHERE id = ?').run(targetId);
    audit(req.user!.sub, 'template.delete', 'template', targetId, {}, req.ip ?? '');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

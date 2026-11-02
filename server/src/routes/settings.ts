import { Router } from 'express';
import { db, audit } from '../db/index.js';
import { str } from '../lib/validate.js';
import { isAdmin } from '../middleware/rbac.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

router.put('/', isAdmin, (req, res, next) => {
  try {
    const entries = Object.entries(req.body ?? {});
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    const tx = db.transaction(() => {
      for (const [key, value] of entries) upsert.run(str(key, 'key', { max: 60 }), str(String(value), 'value', { max: 2000, optional: true }));
    });
    tx();
    audit(req.user!.sub, 'settings.update', 'settings', '', { keys: entries.map(([k]) => k) }, req.ip ?? '');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/audit', isAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(Math.min(Number(req.query.limit ?? 100), 500), Number(req.query.offset ?? 0));
  res.json({ rows });
});

export default router;

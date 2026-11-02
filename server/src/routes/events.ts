import { Router } from 'express';
import { db } from '../db/index.js';
import { sseHandler } from '../realtime/sse.js';

const router = Router();

router.get('/stream', sseHandler);

router.get('/notifications', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(req.user!.sub);
  const unread = (db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0').get(req.user!.sub) as { c: number }).c;
  res.json({ rows, unread });
});

router.post('/notifications/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user!.sub);
  res.json({ ok: true });
});

export default router;

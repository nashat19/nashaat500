import { db } from '../db/index.js';
import { emitToUser } from '../realtime/sse.js';

export function notify(userId: number, type: string, title: string, body = '', link = ''): void {
  const info = db
    .prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)')
    .run(userId, type, title, body, link);
  emitToUser(userId, 'notification', { id: Number(info.lastInsertRowid), type, title, body, link });
}

export function notifyRole(role: string, type: string, title: string, body = '', link = ''): void {
  const rows = db.prepare('SELECT id FROM users WHERE role = ? AND active = 1').all(role) as { id: number }[];
  for (const r of rows) notify(r.id, type, title, body, link);
}

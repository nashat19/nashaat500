import { db } from '../db/index.js';
import { notFound } from '../lib/errors.js';
import { notify } from './notify.js';
import { broadcast } from '../realtime/sse.js';
import { scoreLead } from './leads.js';

export function upsertConversation(pageId: number, externalUserId: string, externalUserName: string, avatarUrl: string): number {
  const existing = db
    .prepare('SELECT id FROM conversations WHERE page_id = ? AND external_user_id = ?')
    .get(pageId, externalUserId) as { id: number } | undefined;
  if (existing) return existing.id;

  const info = db
    .prepare('INSERT INTO conversations (page_id, external_user_id, external_user_name, avatar_url) VALUES (?,?,?,?)')
    .run(pageId, externalUserId, externalUserName, avatarUrl);
  return Number(info.lastInsertRowid);
}

export function ingestMessage(input: {
  pageId: number;
  externalUserId: string;
  externalUserName: string;
  avatarUrl: string;
  body: string;
  externalMessageId: string;
  attachments: string[];
}): void {
  const conversationId = upsertConversation(input.pageId, input.externalUserId, input.externalUserName, input.avatarUrl);

  db.prepare('INSERT INTO messages (conversation_id, direction, body, attachments_json, external_id) VALUES (?,?,?,?,?)').run(
    conversationId,
    'in',
    input.body,
    JSON.stringify(input.attachments),
    input.externalMessageId,
  );
  db.prepare("UPDATE conversations SET unread_count = unread_count + 1, last_message_at = datetime('now'), status = 'open' WHERE id = ?").run(
    conversationId,
  );

  const conv = db.prepare('SELECT assignee_id, external_user_name FROM conversations WHERE id = ?').get(conversationId) as
    | { assignee_id: number | null; external_user_name: string }
    | undefined;

  if (conv?.assignee_id) {
    notify(conv.assignee_id, 'message', `رسالة من ${conv.external_user_name}`, input.body.slice(0, 80), `/inbox/${conversationId}`);
  }
  broadcast('message', { conversationId, preview: input.body.slice(0, 80) });

  maybeCaptureLead(conversationId, input.body);
}

const AMOUNT_RE = /(\d[\d,.]{2,})\s*(مليون|الف|ألف|دينار|د\.ع|iqd)?/i;

function maybeCaptureLead(conversationId: number, body: string): void {
  const auto = db.prepare("SELECT value FROM settings WHERE key = 'auto_lead_capture'").get() as { value: string } | undefined;
  if (auto?.value !== '1') return;

  const already = db.prepare('SELECT id FROM leads WHERE conversation_id = ?').get(conversationId);
  if (already) return;

  const match = body.match(AMOUNT_RE);
  const hasIntent = /قرض|تمويل|سلفة|مبلغ|أريد|اريد/.test(body);
  if (!hasIntent) return;

  const conv = db
    .prepare('SELECT c.*, p.platform FROM conversations c JOIN pages p ON p.id = c.page_id WHERE c.id = ?')
    .get(conversationId) as
    | { external_user_name: string; external_user_id: string; page_id: number; platform: string }
    | undefined;
  if (!conv) return;

  let amount = 0;
  if (match) {
    const raw = Number(match[1].replace(/[,.]/g, ''));
    const unit = match[2] ?? '';
    amount = /مليون/.test(unit) ? raw * 1_000_000 : raw;
  }

  const phone = /^\+?\d{10,13}$/.test(conv.external_user_id) ? conv.external_user_id : '';
  const score = scoreLead({ amount, phone, email: '', purpose: body, sourcePlatform: conv.platform });

  const info = db
    .prepare(
      'INSERT INTO leads (full_name, phone, amount, purpose, source_platform, source_page_id, conversation_id, score) VALUES (?,?,?,?,?,?,?,?)',
    )
    .run(conv.external_user_name, phone, amount, body.slice(0, 200), conv.platform, conv.page_id, conversationId, score);

  db.prepare('INSERT INTO lead_events (lead_id, type, payload) VALUES (?,?,?)').run(
    Number(info.lastInsertRowid),
    'auto_capture',
    JSON.stringify({ body: body.slice(0, 200) }),
  );

  broadcast('lead', { leadId: Number(info.lastInsertRowid), name: conv.external_user_name, score });
}

export function listConversations(filters: { status?: string; assigneeId?: number; pageId?: number; limit: number; offset: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.status) { where.push('c.status = ?'); params.push(filters.status); }
  if (filters.assigneeId) { where.push('c.assignee_id = ?'); params.push(filters.assigneeId); }
  if (filters.pageId) { where.push('c.page_id = ?'); params.push(filters.pageId); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return db
    .prepare(
      `SELECT c.*, p.name AS page_name, p.platform, u.name AS assignee_name,
        (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS preview
       FROM conversations c JOIN pages p ON p.id = c.page_id LEFT JOIN users u ON u.id = c.assignee_id
       ${clause} ORDER BY c.last_message_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, filters.limit, filters.offset);
}

export function getConversation(id: number) {
  const conv = db
    .prepare(
      `SELECT c.*, p.name AS page_name, p.platform, u.name AS assignee_name
       FROM conversations c JOIN pages p ON p.id = c.page_id LEFT JOIN users u ON u.id = c.assignee_id WHERE c.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!conv) throw notFound('المحادثة غير موجودة');

  const messages = db
    .prepare('SELECT m.*, u.name AS author_name FROM messages m LEFT JOIN users u ON u.id = m.author_id WHERE m.conversation_id = ? ORDER BY m.created_at ASC')
    .all(id);

  db.prepare('UPDATE conversations SET unread_count = 0 WHERE id = ?').run(id);
  return { ...conv, messages };
}

export function reply(conversationId: number, body: string, userId: number): void {
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ?').get(conversationId);
  if (!conv) throw notFound('المحادثة غير موجودة');

  db.prepare('INSERT INTO messages (conversation_id, direction, body, author_id) VALUES (?,?,?,?)').run(
    conversationId,
    'out',
    body,
    userId,
  );
  db.prepare("UPDATE conversations SET last_message_at = datetime('now'), status = 'pending' WHERE id = ?").run(conversationId);
  broadcast('message', { conversationId, preview: body.slice(0, 80) });
}

export function assign(conversationId: number, userId: number | null): void {
  db.prepare('UPDATE conversations SET assignee_id = ? WHERE id = ?').run(userId, conversationId);
}

export function setStatus(conversationId: number, status: string): void {
  db.prepare('UPDATE conversations SET status = ? WHERE id = ?').run(status, conversationId);
}

import { db, audit } from '../db/index.js';
import { badRequest, notFound } from '../lib/errors.js';
import { notifyRole } from './notify.js';

export const POST_STATUSES = ['draft', 'pending', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'rejected'] as const;

export interface PostRow {
  id: number;
  title: string;
  body: string;
  media_json: string;
  product_id: number | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  created_by: number | null;
  approved_by: number | null;
  created_at: string;
  updated_at: string;
}

export function getPost(id: number): PostRow {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as PostRow | undefined;
  if (!row) throw notFound('المنشور غير موجود');
  return row;
}

export function targetsOf(postId: number) {
  return db
    .prepare(
      `SELECT pt.*, p.name AS page_name, p.platform, p.handle
       FROM post_targets pt JOIN pages p ON p.id = pt.page_id WHERE pt.post_id = ?`,
    )
    .all(postId) as Record<string, unknown>[];
}

export function createPost(input: {
  title: string;
  body: string;
  media: string[];
  productId: number | null;
  pageIds: number[];
  scheduledAt: string | null;
  status: string;
  userId: number;
  ip: string;
}): PostRow {
  if (input.pageIds.length === 0) throw badRequest('اختر صفحة واحدة على الأقل');
  if (input.status === 'scheduled' && !input.scheduledAt) throw badRequest('الجدولة تتطلب وقتاً');

  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO posts (title, body, media_json, product_id, status, scheduled_at, created_by) VALUES (?,?,?,?,?,?,?)')
      .run(input.title, input.body, JSON.stringify(input.media), input.productId, input.status, input.scheduledAt, input.userId);
    const postId = Number(info.lastInsertRowid);
    const insertTarget = db.prepare('INSERT INTO post_targets (post_id, page_id) VALUES (?,?)');
    for (const pageId of input.pageIds) insertTarget.run(postId, pageId);
    return postId;
  });

  const id = tx();
  audit(input.userId, 'post.create', 'post', id, { status: input.status }, input.ip);
  if (input.status === 'pending') {
    notifyRole('manager', 'approval', 'منشور بانتظار الموافقة', input.title || input.body.slice(0, 60), `/posts/${id}`);
  }
  return getPost(id);
}

export function updatePost(
  id: number,
  patch: { title?: string; body?: string; media?: string[]; productId?: number | null; scheduledAt?: string | null; pageIds?: number[] },
  userId: number,
  ip: string,
): PostRow {
  const post = getPost(id);
  if (['published', 'publishing'].includes(post.status)) throw badRequest('لا يمكن تعديل منشور منشور');

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE posts SET title = ?, body = ?, media_json = ?, product_id = ?, scheduled_at = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(
      patch.title ?? post.title,
      patch.body ?? post.body,
      JSON.stringify(patch.media ?? JSON.parse(post.media_json)),
      patch.productId === undefined ? post.product_id : patch.productId,
      patch.scheduledAt === undefined ? post.scheduled_at : patch.scheduledAt,
      id,
    );
    if (patch.pageIds) {
      db.prepare('DELETE FROM post_targets WHERE post_id = ?').run(id);
      const insertTarget = db.prepare('INSERT INTO post_targets (post_id, page_id) VALUES (?,?)');
      for (const pageId of patch.pageIds) insertTarget.run(id, pageId);
    }
  });
  tx();
  audit(userId, 'post.update', 'post', id, {}, ip);
  return getPost(id);
}

export function transition(
  id: number,
  action: 'submit' | 'approve' | 'reject' | 'schedule' | 'cancel',
  userId: number,
  ip: string,
  scheduledAt?: string | null,
): PostRow {
  const post = getPost(id);
  const map: Record<string, { from: string[]; to: string }> = {
    submit: { from: ['draft', 'rejected'], to: 'pending' },
    approve: { from: ['pending'], to: 'approved' },
    reject: { from: ['pending', 'approved'], to: 'rejected' },
    schedule: { from: ['approved', 'draft', 'pending'], to: 'scheduled' },
    cancel: { from: ['scheduled', 'pending', 'approved'], to: 'draft' },
  };
  const rule = map[action];
  if (!rule) throw badRequest('إجراء غير معروف');
  if (!rule.from.includes(post.status)) throw badRequest(`لا يمكن تنفيذ "${action}" على حالة "${post.status}"`);

  const when = action === 'schedule' ? (scheduledAt ?? post.scheduled_at) : post.scheduled_at;
  if (action === 'schedule' && !when) throw badRequest('حدد وقت الجدولة');

  db.prepare('UPDATE posts SET status = ?, scheduled_at = ?, approved_by = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    rule.to,
    when,
    action === 'approve' ? userId : post.approved_by,
    id,
  );
  audit(userId, `post.${action}`, 'post', id, {}, ip);
  return getPost(id);
}

export function deletePost(id: number, userId: number, ip: string): void {
  getPost(id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  audit(userId, 'post.delete', 'post', id, {}, ip);
}

export function listPosts(filters: { status?: string; pageId?: number; from?: string; to?: string; limit: number; offset: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.status) { where.push('p.status = ?'); params.push(filters.status); }
  if (filters.from) { where.push('COALESCE(p.scheduled_at, p.created_at) >= ?'); params.push(filters.from); }
  if (filters.to) { where.push('COALESCE(p.scheduled_at, p.created_at) <= ?'); params.push(filters.to); }
  if (filters.pageId) { where.push('EXISTS (SELECT 1 FROM post_targets t WHERE t.post_id = p.id AND t.page_id = ?)'); params.push(filters.pageId); }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT p.*, u.name AS author_name, pr.image_url AS product_image, pr.name AS product_name
       FROM posts p LEFT JOIN users u ON u.id = p.created_by LEFT JOIN products pr ON pr.id = p.product_id
       ${clause} ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, filters.limit, filters.offset) as (PostRow & { author_name: string | null; product_image: string | null; product_name: string | null })[];

  const total = (db.prepare(`SELECT COUNT(*) AS c FROM posts p ${clause}`).get(...params) as { c: number }).c;
  return { rows: rows.map((r) => ({ ...r, targets: targetsOf(r.id) })), total };
}

import { db } from '../db/index.js';
import { log } from '../lib/logger.js';
import { getConnector } from './connectors/registry.js';
import { getPage, pageToken, type PageRow } from './pages.js';
import { notifyRole } from './notify.js';

const TICK_MS = 15_000;
let running = false;

async function publishTarget(target: { id: number; post_id: number; page_id: number }, post: { body: string; title: string; media_json: string }) {
  const page = getPage(target.page_id);
  const connector = getConnector(page.platform);

  if (!connector) {
    db.prepare('UPDATE post_targets SET status = ?, error = ? WHERE id = ?').run('failed', 'المنصة غير مدعومة للنشر', target.id);
    return;
  }

  try {
    const result = await connector.publish(page as PageRow, pageToken(page), {
      body: post.body,
      title: post.title,
      media: JSON.parse(post.media_json) as string[],
    });
    db.prepare('UPDATE post_targets SET status = ?, external_post_id = ?, permalink = ? WHERE id = ?').run(
      'published',
      result.externalId,
      result.permalink,
      target.id,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطأ غير معروف';
    db.prepare('UPDATE post_targets SET status = ?, error = ? WHERE id = ?').run('failed', message, target.id);
    log.warn(`فشل النشر على الصفحة ${page.id}`, message);
  }
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const due = db
      .prepare("SELECT * FROM posts WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ? LIMIT 10")
      .all(new Date().toISOString()) as { id: number; body: string; title: string; media_json: string }[];

    for (const post of due) {
      db.prepare("UPDATE posts SET status = 'publishing' WHERE id = ?").run(post.id);
      const targets = db.prepare('SELECT id, post_id, page_id FROM post_targets WHERE post_id = ?').all(post.id) as {
        id: number; post_id: number; page_id: number;
      }[];

      await Promise.all(targets.map((t) => publishTarget(t, post)));

      const failed = (db.prepare("SELECT COUNT(*) AS c FROM post_targets WHERE post_id = ? AND status = 'failed'").get(post.id) as { c: number }).c;
      const status = failed === targets.length ? 'failed' : 'published';
      db.prepare('UPDATE posts SET status = ?, published_at = ? WHERE id = ?').run(status, new Date().toISOString(), post.id);

      if (status === 'failed') notifyRole('manager', 'publish_failed', 'فشل نشر منشور', post.title || post.body.slice(0, 60), `/posts/${post.id}`);
    }
  } catch (err) {
    log.error('خطأ في المجدول', err);
  } finally {
    running = false;
  }
}

export function startScheduler(): NodeJS.Timeout {
  log.info('المجدول يعمل');
  const timer = setInterval(() => void tick(), TICK_MS);
  void tick();
  return timer;
}

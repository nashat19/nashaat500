import { db, audit } from '../db/index.js';
import { decrypt, encrypt } from '../lib/crypto.js';
import { conflict, notFound } from '../lib/errors.js';

export interface PageRow {
  id: number;
  platform: string;
  name: string;
  handle: string;
  external_id: string;
  avatar_url: string;
  access_token_enc: string;
  status: string;
  followers: number;
  created_by: number | null;
  created_at: string;
}

export const PLATFORMS = ['facebook', 'instagram', 'telegram', 'whatsapp', 'tiktok', 'x'] as const;

export function listPages(): PageRow[] {
  return db.prepare('SELECT * FROM pages ORDER BY created_at DESC').all() as PageRow[];
}

export function getPage(id: number): PageRow {
  const row = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as PageRow | undefined;
  if (!row) throw notFound('الصفحة غير موجودة');
  return row;
}

export function pageToken(page: PageRow): string {
  if (!page.access_token_enc) return '';
  try {
    return decrypt(page.access_token_enc);
  } catch {
    return '';
  }
}

export function createPage(input: {
  platform: string;
  name: string;
  handle: string;
  externalId: string;
  accessToken: string;
  avatarUrl: string;
  followers: number;
  userId: number;
  ip: string;
}): PageRow {
  const dup = db
    .prepare('SELECT id FROM pages WHERE platform = ? AND external_id = ? AND external_id <> ""')
    .get(input.platform, input.externalId);
  if (dup) throw conflict('هذه الصفحة مربوطة مسبقاً');

  const info = db
    .prepare(
      'INSERT INTO pages (platform, name, handle, external_id, avatar_url, access_token_enc, followers, created_by) VALUES (?,?,?,?,?,?,?,?)',
    )
    .run(
      input.platform,
      input.name,
      input.handle,
      input.externalId,
      input.avatarUrl,
      input.accessToken ? encrypt(input.accessToken) : '',
      input.followers,
      input.userId,
    );

  const id = Number(info.lastInsertRowid);
  audit(input.userId, 'page.create', 'page', id, { platform: input.platform }, input.ip);
  return getPage(id);
}

export function updatePage(
  id: number,
  patch: Partial<Pick<PageRow, 'name' | 'handle' | 'status' | 'followers' | 'avatar_url'>> & { accessToken?: string },
  userId: number,
  ip: string,
): PageRow {
  const page = getPage(id);
  db.prepare('UPDATE pages SET name = ?, handle = ?, status = ?, followers = ?, avatar_url = ?, access_token_enc = ? WHERE id = ?').run(
    patch.name ?? page.name,
    patch.handle ?? page.handle,
    patch.status ?? page.status,
    patch.followers ?? page.followers,
    patch.avatar_url ?? page.avatar_url,
    patch.accessToken ? encrypt(patch.accessToken) : page.access_token_enc,
    id,
  );
  audit(userId, 'page.update', 'page', id, {}, ip);
  return getPage(id);
}

export function deletePage(id: number, userId: number, ip: string): void {
  getPage(id);
  db.prepare('DELETE FROM pages WHERE id = ?').run(id);
  audit(userId, 'page.delete', 'page', id, {}, ip);
}

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export function migrate(): void {
  const schemaPath = new URL('./schema.sql', import.meta.url);
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
}

export function audit(userId: number | null, action: string, entity = '', entityId: string | number = '', meta: unknown = {}, ip = ''): void {
  db.prepare('INSERT INTO audit_log (user_id, action, entity, entity_id, meta, ip) VALUES (?,?,?,?,?,?)')
    .run(userId, action, entity, String(entityId), JSON.stringify(meta), ip);
}

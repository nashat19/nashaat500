PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','manager','agent','viewer')),
  color         TEXT NOT NULL DEFAULT '#2563eb',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  platform         TEXT NOT NULL CHECK (platform IN ('facebook','instagram','telegram','whatsapp','tiktok','x')),
  name             TEXT NOT NULL,
  handle           TEXT NOT NULL DEFAULT '',
  external_id      TEXT NOT NULL DEFAULT '',
  avatar_url       TEXT NOT NULL DEFAULT '',
  access_token_enc TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','needs_reauth','disabled')),
  followers        INTEGER NOT NULL DEFAULT 0,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (platform, external_id)
);

CREATE TABLE IF NOT EXISTS page_members (
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, user_id)
);

CREATE TABLE IF NOT EXISTS products (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  brand      TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT 'phone'
             CHECK (category IN ('phone','laptop','tablet','tv','appliance','console','accessory','other')),
  price      REAL NOT NULL DEFAULT 0,
  specs      TEXT NOT NULL DEFAULT '',
  image_url  TEXT NOT NULL DEFAULT '',
  stock      INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'عام',
  body       TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL,
  media_json   TEXT NOT NULL DEFAULT '[]',
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','pending','approved','scheduled','publishing','published','failed','rejected')),
  scheduled_at TEXT,
  published_at TEXT,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post_targets (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id          INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  page_id          INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','published','failed','skipped')),
  external_post_id TEXT NOT NULL DEFAULT '',
  permalink        TEXT NOT NULL DEFAULT '',
  error            TEXT NOT NULL DEFAULT '',
  metrics_json     TEXT NOT NULL DEFAULT '{}',
  UNIQUE (post_id, page_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id            INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  external_user_id   TEXT NOT NULL,
  external_user_name TEXT NOT NULL DEFAULT 'زائر',
  avatar_url         TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  assignee_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  unread_count       INTEGER NOT NULL DEFAULT 0,
  last_message_at    TEXT NOT NULL DEFAULT (datetime('now')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (page_id, external_user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id  INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction        TEXT NOT NULL CHECK (direction IN ('in','out')),
  body             TEXT NOT NULL DEFAULT '',
  attachments_json TEXT NOT NULL DEFAULT '[]',
  external_id      TEXT NOT NULL DEFAULT '',
  author_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name       TEXT NOT NULL,
  phone           TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  city            TEXT NOT NULL DEFAULT '',
  product_id      INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name    TEXT NOT NULL DEFAULT '',
  price           REAL NOT NULL DEFAULT 0,
  down_payment    REAL NOT NULL DEFAULT 0,
  months          INTEGER NOT NULL DEFAULT 12,
  monthly_amount  REAL NOT NULL DEFAULT 0,
  job             TEXT NOT NULL DEFAULT 'private'
                  CHECK (job IN ('government','private','self','retired','student','none')),
  salary          REAL NOT NULL DEFAULT 0,
  source_platform TEXT NOT NULL DEFAULT 'manual',
  source_page_id  INTEGER REFERENCES pages(id) ON DELETE SET NULL,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  stage           TEXT NOT NULL DEFAULT 'new'
                  CHECK (stage IN ('new','contacted','docs','credit_check','approved','contract','delivered','rejected','lost')),
  score           INTEGER NOT NULL DEFAULT 0,
  notes           TEXT NOT NULL DEFAULT '',
  owner_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lead_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  payload    TEXT NOT NULL DEFAULT '{}',
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analytics_daily (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id     INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,
  reach       INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  engagements INTEGER NOT NULL DEFAULT 0,
  clicks      INTEGER NOT NULL DEFAULT 0,
  followers   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (page_id, day)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT NOT NULL DEFAULT '',
  read       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL DEFAULT '',
  entity_id  TEXT NOT NULL DEFAULT '',
  meta       TEXT NOT NULL DEFAULT '{}',
  ip         TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_status_sched ON posts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage, updated_at);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_analytics_day ON analytics_daily(day);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category, active);

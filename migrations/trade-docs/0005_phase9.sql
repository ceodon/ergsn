-- Phase 9 migration — closes Tier-A/B/C remaining items

-- 9-B #18 — Doc state: 'draft' lets admin save without exposing to buyer.
-- Buyer portal hides drafts; only 'issued' rows render in /buyer view.
ALTER TABLE quotations          ADD COLUMN state TEXT NOT NULL DEFAULT 'issued';
ALTER TABLE purchase_orders     ADD COLUMN state TEXT NOT NULL DEFAULT 'issued';
ALTER TABLE proforma_invoices   ADD COLUMN state TEXT NOT NULL DEFAULT 'issued';
ALTER TABLE commercial_invoices ADD COLUMN state TEXT NOT NULL DEFAULT 'issued';
ALTER TABLE packing_lists       ADD COLUMN state TEXT NOT NULL DEFAULT 'issued';
CREATE INDEX IF NOT EXISTS idx_q_state  ON quotations(state);
CREATE INDEX IF NOT EXISTS idx_pi_state ON proforma_invoices(state);
CREATE INDEX IF NOT EXISTS idx_ci_state ON commercial_invoices(state);
CREATE INDEX IF NOT EXISTS idx_pl_state ON packing_lists(state);

-- 9-C #23 — Webhook delivery queue (per-attempt log + retry backoff)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id      INTEGER NOT NULL,
  event           TEXT NOT NULL,
  payload         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | dead
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER,
  last_error      TEXT,
  next_attempt_at INTEGER NOT NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wd_status ON webhook_deliveries(status, next_attempt_at);

-- 9-C #28 — Audit archive (older than 365d migrated nightly by cron)
CREATE TABLE IF NOT EXISTS audit_log_archive (
  id             INTEGER PRIMARY KEY,
  transaction_id TEXT,
  doc_id         TEXT,
  action         TEXT NOT NULL,
  from_status    TEXT,
  to_status      TEXT,
  detail         TEXT,
  actor          TEXT,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_arch_tx ON audit_log_archive(transaction_id);

-- 9-D #6 — Multi-user (per-user API keys + role)
CREATE TABLE IF NOT EXISTS admin_users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT UNIQUE NOT NULL,
  api_key      TEXT UNIQUE NOT NULL,        -- random 32-hex
  role         TEXT NOT NULL DEFAULT 'viewer', -- owner | trader | accountant | viewer
  display_name TEXT,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER,
  disabled_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_admin_users_key ON admin_users(api_key);

-- 9-D #7 — GDPR redaction marker
ALTER TABLE transactions ADD COLUMN redacted_at INTEGER;

-- 9-D #8 — D1 backup runs (cron-driven exports to R2)
CREATE TABLE IF NOT EXISTS backup_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at      INTEGER NOT NULL,
  ok          INTEGER NOT NULL DEFAULT 1,
  bytes       INTEGER,
  r2_key      TEXT,
  notes       TEXT
);

-- 9-E #12 — Maker master + junction so a transaction can carry multiple makers
CREATE TABLE IF NOT EXISTS makers (
  id              TEXT PRIMARY KEY,                  -- 'MK-2026-0001'
  name            TEXT NOT NULL,
  sector          TEXT,
  tier            TEXT NOT NULL DEFAULT 'verified',  -- free | verified | featured | exclusive
  contact_email   TEXT,
  contact_phone   TEXT,
  contact_telegram TEXT,
  certifications  TEXT,                              -- comma-list
  notes           TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_maker_sector ON makers(sector);
CREATE INDEX IF NOT EXISTS idx_maker_tier   ON makers(tier);

CREATE TABLE IF NOT EXISTS transaction_makers (
  transaction_id TEXT NOT NULL,
  maker_id       TEXT NOT NULL,
  primary_flag   INTEGER NOT NULL DEFAULT 0,
  share_pct      REAL,                               -- if multiple, what % of value belongs to each maker
  added_at       INTEGER NOT NULL,
  PRIMARY KEY (transaction_id, maker_id)
);
CREATE INDEX IF NOT EXISTS idx_txm_maker ON transaction_makers(maker_id);

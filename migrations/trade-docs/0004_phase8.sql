-- Phase 8 migration — revisions, token rotation, locale toggle, system settings,
-- rate limits, deletable attachments, KR seller fields, ERP webhooks
--
-- Each ALTER is a separate statement so D1's migration runner can apply them
-- in sequence. The Worker treats new columns as optional.

-- 8-A #2 — Document revision tracking
-- Each doc gets a revision counter (1 by default) and a pointer to the
-- previous revision so we can show "v2 supersedes v1" in admin and buyer
-- portals. `superseded_at` is set on the previous row when a new revision
-- is issued so old rows don't disappear from history.
ALTER TABLE quotations          ADD COLUMN revision      INTEGER NOT NULL DEFAULT 1;
ALTER TABLE quotations          ADD COLUMN parent_doc_id TEXT;
ALTER TABLE quotations          ADD COLUMN superseded_at INTEGER;
ALTER TABLE purchase_orders     ADD COLUMN revision      INTEGER NOT NULL DEFAULT 1;
ALTER TABLE purchase_orders     ADD COLUMN parent_doc_id TEXT;
ALTER TABLE purchase_orders     ADD COLUMN superseded_at INTEGER;
ALTER TABLE proforma_invoices   ADD COLUMN revision      INTEGER NOT NULL DEFAULT 1;
ALTER TABLE proforma_invoices   ADD COLUMN parent_doc_id TEXT;
ALTER TABLE proforma_invoices   ADD COLUMN superseded_at INTEGER;
ALTER TABLE commercial_invoices ADD COLUMN revision      INTEGER NOT NULL DEFAULT 1;
ALTER TABLE commercial_invoices ADD COLUMN parent_doc_id TEXT;
ALTER TABLE commercial_invoices ADD COLUMN superseded_at INTEGER;
ALTER TABLE packing_lists       ADD COLUMN revision      INTEGER NOT NULL DEFAULT 1;
ALTER TABLE packing_lists       ADD COLUMN parent_doc_id TEXT;
ALTER TABLE packing_lists       ADD COLUMN superseded_at INTEGER;

-- 8-A #10 — Buyer token rotation
ALTER TABLE transactions ADD COLUMN buyer_token_rotated_at INTEGER;
ALTER TABLE transactions ADD COLUMN buyer_token_expires_at INTEGER;

-- 8-C — Locale toggle (English vs Korean invoice render)
ALTER TABLE transactions ADD COLUMN locale TEXT DEFAULT 'en';

-- 8-A #4 — Soft-delete on attachments (kept for audit, hidden from listings)
ALTER TABLE attachments ADD COLUMN deleted_at INTEGER;

-- 8-B #16 — Outbound ERP webhooks (per-tx or global). When configured, Worker
-- POSTs every status transition + doc.create to the URL with a signed payload.
CREATE TABLE IF NOT EXISTS webhooks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  scope        TEXT NOT NULL DEFAULT 'global',  -- 'global' or transaction id
  url          TEXT NOT NULL,
  secret       TEXT,                            -- HMAC-SHA256 if set
  events       TEXT NOT NULL DEFAULT 'all',     -- comma list or 'all'
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL
);

-- 8-A #9 — Lightweight rate limiting (sliding 60s window per ip + path).
-- D1 isn't ideal for hot rate-limit counters, but the volume on this Worker
-- is tiny (<100 req/sec sustained even under attack) so this is fine.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT NOT NULL,                   -- 'ip|path|minute'
  count        INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL,
  PRIMARY KEY (bucket)
);

-- 8-A #1 / #5 — System settings (seller business number / representative /
-- seal R2 key, ERP webhook defaults, reminder thresholds). One key per row.
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES
  ('seller_biz_number',   '',                 strftime('%s','now')*1000),
  ('seller_representative','',                 strftime('%s','now')*1000),
  ('seller_phone',         '+82-10-5288-0006', strftime('%s','now')*1000),
  ('seller_seal_r2_key',   '',                 strftime('%s','now')*1000),
  ('reminder_quote_days',  '3',                strftime('%s','now')*1000),
  ('reminder_unpaid_days', '7',                strftime('%s','now')*1000);

-- 8-B #11 — Last-run tracking for the cron reminder so we don't double-fire
-- and we can show the owner "last reminder run was X ago" in admin.
CREATE TABLE IF NOT EXISTS cron_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job         TEXT NOT NULL,                   -- 'reminders'
  ran_at      INTEGER NOT NULL,
  ok          INTEGER NOT NULL DEFAULT 1,
  notes       TEXT
);
CREATE INDEX IF NOT EXISTS idx_cron_job ON cron_runs(job);

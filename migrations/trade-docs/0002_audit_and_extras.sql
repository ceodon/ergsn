-- Phase 7 migration — audit log + per-doc extras
-- Adds an immutable event log so we can answer "who changed what when",
-- plus a few promoted columns that Phase 7 surfaces depend on.

CREATE TABLE IF NOT EXISTS audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id  TEXT,                               -- nullable (some events are tx-less)
  doc_id          TEXT,                               -- nullable
  action          TEXT NOT NULL,                      -- e.g. 'tx.create', 'tx.status', 'doc.create', 'doc.send', 'po.buyer-submit'
  from_status     TEXT,                               -- for status transitions
  to_status       TEXT,
  detail          TEXT,                               -- free-form JSON or text (≤2k)
  actor           TEXT,                               -- 'admin' | 'buyer' | 'system'
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_tx       ON audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_log(action);

-- Convert RFQ-originated transactions: store the originating tracker id so
-- admin can jump back to the RFQ context.
ALTER TABLE transactions ADD COLUMN rfq_tracker_id TEXT;
ALTER TABLE transactions ADD COLUMN rfq_summary    TEXT;     -- short snapshot of original RFQ
ALTER TABLE transactions ADD COLUMN po_locked_at   INTEGER;  -- once a PO is submitted, lock further buyer POs (Tier 2 #15)

-- Email send history per doc — every Send-to-buyer call records here so we
-- have a "this quote was emailed on X" affordance.
CREATE TABLE IF NOT EXISTS email_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id  TEXT NOT NULL,
  doc_id          TEXT,
  doc_type        TEXT,
  to_email        TEXT NOT NULL,
  subject         TEXT,
  status          TEXT NOT NULL,                       -- 'sent' | 'failed'
  detail          TEXT,                                -- error message if failed
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_tx ON email_log(transaction_id);

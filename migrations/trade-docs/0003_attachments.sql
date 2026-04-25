-- Phase 7-F migration — file attachments stored in R2
--
-- We never put binary blobs in D1; the file payload lives in R2 keyed by
-- the `r2_key` column. D1 holds metadata + ACL (which transaction it
-- belongs to, who uploaded, mime type, size).
--
-- Allowed attachment kinds:
--   payment-proof  — buyer-uploaded wire transfer receipt
--   bl             — admin-uploaded bill of lading scan
--   coa            — admin-uploaded certificate of analysis
--   coo            — certificate of origin
--   other          — generic
CREATE TABLE IF NOT EXISTS attachments (
  id              TEXT PRIMARY KEY,        -- 'AT-2026-0001'
  transaction_id  TEXT NOT NULL,
  doc_id          TEXT,                    -- nullable: may be tied to a specific doc
  kind            TEXT NOT NULL DEFAULT 'other',
  filename        TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      INTEGER,
  r2_key          TEXT NOT NULL UNIQUE,    -- key in the R2 bucket
  uploaded_by     TEXT,                    -- 'admin' | 'buyer' | 'system'
  notes           TEXT,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);
CREATE INDEX IF NOT EXISTS idx_att_tx   ON attachments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_att_doc  ON attachments(doc_id);
CREATE INDEX IF NOT EXISTS idx_att_kind ON attachments(kind);

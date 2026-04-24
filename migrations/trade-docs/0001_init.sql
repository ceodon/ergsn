-- ERGSN Trade Documentation — initial schema (Phase 1 baseline)
--
-- Transaction = single buyer journey from RFQ → shipment.
-- Each doc table holds one row per issued document, linked by transaction_id.
-- All form fields are stored in `data` (JSON) so we can extend each doc type
-- without schema migrations; only fields needed for filtering / lookup are
-- promoted to top-level columns.

CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT PRIMARY KEY,            -- 'TX-2026-0001'
  buyer_company   TEXT NOT NULL,
  buyer_email     TEXT NOT NULL,
  buyer_country   TEXT,
  ergsn_partner   TEXT,                        -- Korean maker name (e.g. 'COSMEDIQUE Co., Ltd.')
  status          TEXT NOT NULL DEFAULT 'open',
  -- status enum (string for D1 portability):
  --   open · quoted · po-received · proforma-sent · paid ·
  --   commercial-issued · packing-issued · shipped · closed · cancelled
  buyer_token     TEXT NOT NULL UNIQUE,        -- 32-char hex for buyer URL
  notes           TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_token ON transactions(buyer_token);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_buyer_email ON transactions(buyer_email);

CREATE TABLE IF NOT EXISTS quotations (
  id              TEXT PRIMARY KEY,            -- 'Q-2026-0001'
  transaction_id  TEXT NOT NULL,
  data            TEXT NOT NULL,               -- JSON
  total_amount    REAL,
  currency        TEXT,
  valid_until     INTEGER,                     -- ms epoch
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);
CREATE INDEX IF NOT EXISTS idx_q_tx ON quotations(transaction_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              TEXT PRIMARY KEY,            -- 'PO-2026-0001'
  transaction_id  TEXT NOT NULL,
  data            TEXT NOT NULL,
  buyer_signed_at INTEGER,
  buyer_signature TEXT,                        -- base64 signature image (optional)
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);
CREATE INDEX IF NOT EXISTS idx_po_tx ON purchase_orders(transaction_id);

CREATE TABLE IF NOT EXISTS proforma_invoices (
  id              TEXT PRIMARY KEY,            -- 'PI-2026-0001'
  transaction_id  TEXT NOT NULL,
  data            TEXT NOT NULL,
  total_amount    REAL,
  currency        TEXT,
  payment_status  TEXT DEFAULT 'pending',      -- pending · paid · partial · cancelled
  paid_at         INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);
CREATE INDEX IF NOT EXISTS idx_pi_tx ON proforma_invoices(transaction_id);

CREATE TABLE IF NOT EXISTS commercial_invoices (
  id              TEXT PRIMARY KEY,            -- 'CI-2026-0001'
  transaction_id  TEXT NOT NULL,
  data            TEXT NOT NULL,
  total_amount    REAL,
  currency        TEXT,
  bl_number       TEXT,                        -- bill of lading
  container_no    TEXT,
  shipped_at      INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);
CREATE INDEX IF NOT EXISTS idx_ci_tx ON commercial_invoices(transaction_id);

CREATE TABLE IF NOT EXISTS packing_lists (
  id              TEXT PRIMARY KEY,            -- 'PL-2026-0001'
  transaction_id  TEXT NOT NULL,
  data            TEXT NOT NULL,
  total_weight_kg REAL,
  total_volume_m3 REAL,
  carton_count    INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);
CREATE INDEX IF NOT EXISTS idx_pl_tx ON packing_lists(transaction_id);

-- Sequence counters (per doc type per year) for monotonic ID generation.
-- D1 doesn't have native sequences; we use a counter row updated atomically.
CREATE TABLE IF NOT EXISTS id_sequences (
  prefix     TEXT NOT NULL,                    -- 'TX', 'Q', 'PO', 'PI', 'CI', 'PL'
  year       INTEGER NOT NULL,                 -- 2026, 2027, ...
  next_seq   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (prefix, year)
);

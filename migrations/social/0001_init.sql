-- ergsn-social Phase 1 — initial schema
-- Run with:
--   npx wrangler d1 execute ergsn-social --remote \
--     --config wrangler.social.jsonc \
--     --file migrations/social/0001_init.sql

-- Posts: the unit a user writes once and fans out to N platforms.
CREATE TABLE IF NOT EXISTS posts (
  id            TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  scheduled_at  INTEGER,             -- null = draft / publish-now
  published_at  INTEGER,             -- set when fan-out completes
  status        TEXT NOT NULL,       -- draft | scheduled | publishing | published | failed
  source        TEXT NOT NULL,       -- user | ai
  locale        TEXT NOT NULL DEFAULT 'ko',
  body          TEXT NOT NULL,
  hashtags      TEXT,                -- JSON array
  link          TEXT,                -- canonical URL appended to platforms that support it
  images_json   TEXT,                -- JSON: [{ image_id, r2_key, alt, mime, width, height }]
  author_email  TEXT,                -- verified actor (CF Access)
  meta_json     TEXT                 -- arbitrary extras
);
CREATE INDEX IF NOT EXISTS idx_posts_status       ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_created_at   ON posts(created_at);

-- Per-platform fan-out target. One row per (post × platform).
CREATE TABLE IF NOT EXISTS post_targets (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id           TEXT NOT NULL,
  platform          TEXT NOT NULL,    -- facebook_page | instagram | threads | linkedin | naver_blog
  account_label     TEXT,             -- which connected account, e.g. "ergsn-fb-page"
  status            TEXT NOT NULL,    -- pending | publishing | published | failed | skipped
  platform_post_id  TEXT,             -- remote-side id once published
  platform_url      TEXT,             -- direct link to published post
  posted_at         INTEGER,
  error             TEXT,
  request_json      TEXT,             -- last outbound payload (for debugging)
  response_json     TEXT,             -- last raw response
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_post_targets_post     ON post_targets(post_id);
CREATE INDEX IF NOT EXISTS idx_post_targets_platform ON post_targets(platform);
CREATE INDEX IF NOT EXISTS idx_post_targets_status   ON post_targets(status);

-- OAuth tokens (one row per connected account; provider+label is unique).
-- Phase 2 (Meta) and Phase 3 (LinkedIn) populate this.
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  provider      TEXT NOT NULL,        -- meta | linkedin
  account_label TEXT NOT NULL,        -- human-readable, e.g. "ergsn-fb-page", "donald-personal"
  account_id    TEXT,                 -- remote-side account id
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    INTEGER,              -- ms epoch
  scope         TEXT,
  meta_json     TEXT,                 -- e.g. { page_id, instagram_business_id, threads_user_id }
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  UNIQUE(provider, account_label)
);

-- Image library. R2-backed; the same row can be reused across many posts.
-- 'source' tags where the image originated:
--   user    — uploaded via composer
--   product — synced from existing ERGSN product catalog (Phase 5 vision-match)
--   ai      — generated via Stable Diffusion / equiv (Phase 5)
CREATE TABLE IF NOT EXISTS images (
  id           TEXT PRIMARY KEY,
  r2_key       TEXT NOT NULL UNIQUE,
  filename     TEXT,
  mime         TEXT,
  width        INTEGER,
  height       INTEGER,
  size_bytes   INTEGER,
  alt_text     TEXT,
  source       TEXT NOT NULL DEFAULT 'user',
  product_sku  TEXT,                  -- when source = 'product'
  uploaded_by  TEXT,                  -- verified actor email
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_source     ON images(source);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at);

-- Engagement metrics. Phase 6 cron worker fills this in at 24h / 7d / 30d.
CREATE TABLE IF NOT EXISTS insights (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  post_target_id  INTEGER NOT NULL,
  fetched_at      INTEGER NOT NULL,
  bucket          TEXT NOT NULL,       -- 24h | 7d | 30d | latest
  impressions     INTEGER,
  reach           INTEGER,
  likes           INTEGER,
  comments        INTEGER,
  shares          INTEGER,
  saves           INTEGER,
  clicks          INTEGER,
  raw_json        TEXT,                -- full platform-specific payload
  FOREIGN KEY (post_target_id) REFERENCES post_targets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_insights_post_target ON insights(post_target_id);
CREATE INDEX IF NOT EXISTS idx_insights_bucket      ON insights(bucket);

-- Reusable templates (prompts + default platforms + default hashtags).
-- AI-draft mode (Phase 5) loads these as prompt seeds.
CREATE TABLE IF NOT EXISTS templates (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  prompt            TEXT,
  default_platforms TEXT,              -- JSON array
  default_locale    TEXT DEFAULT 'ko',
  default_hashtags  TEXT,              -- JSON array
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

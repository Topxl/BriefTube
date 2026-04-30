-- Tier 2 engagement tracking on deliveries.
-- Applied via Supabase MCP on 2026-04-30.
--
-- listened_at already existed (first-engagement timestamp). Adds:
--   listen_progress_pct  — max progress (0-100) reached for this delivery
--   completed            — true once progress reaches >=90%
--   last_listened_at     — most recent activity (vs listened_at = first)
--
-- Backfill: rows with listened_at but no progress get progress=0 + last=listened_at.

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS listen_progress_pct integer,
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_listened_at timestamptz;

ALTER TABLE deliveries
  DROP CONSTRAINT IF EXISTS deliveries_listen_progress_pct_range;
ALTER TABLE deliveries
  ADD CONSTRAINT deliveries_listen_progress_pct_range
  CHECK (listen_progress_pct IS NULL OR (listen_progress_pct >= 0 AND listen_progress_pct <= 100));

UPDATE deliveries
SET listen_progress_pct = 0, last_listened_at = listened_at
WHERE listened_at IS NOT NULL AND listen_progress_pct IS NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_completed
  ON deliveries (completed)
  WHERE listened_at IS NOT NULL;

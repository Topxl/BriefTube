-- Tier 1 generation metrics for the admin stats dashboard.
-- Applied via Supabase MCP on 2026-04-28.
--
-- Columns:
--   length_pref           — preset used at generation (auto/brief/standard/detailed)
--   style_pref            — style used (narrative/key_points/actionable)
--   model_used            — gemini-2.5-flash | gemini-2.5-flash-lite | openrouter:<model>
--   summary_cost_usd      — Gemini/OpenRouter cost in USD (transcript_cost was already there)
--   summary_word_count    — language-agnostic length (chars vary by language)
--   audio_duration_sec    — ground-truth audio length via ffprobe
--   generation_latency_ms — jsonb {transcript_ms, summary_ms, tts_ms, upload_ms, total_ms}
--
-- Two partial indexes for fast aggregation on completed rows.

ALTER TABLE processed_videos
  ADD COLUMN IF NOT EXISTS length_pref text,
  ADD COLUMN IF NOT EXISTS style_pref text,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS summary_cost_usd numeric(10, 6),
  ADD COLUMN IF NOT EXISTS summary_word_count integer,
  ADD COLUMN IF NOT EXISTS audio_duration_sec numeric(8, 2),
  ADD COLUMN IF NOT EXISTS generation_latency_ms jsonb;

CREATE INDEX IF NOT EXISTS idx_processed_videos_processed_at_completed
  ON processed_videos (processed_at DESC)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_processed_videos_model_used
  ON processed_videos (model_used)
  WHERE status = 'completed' AND model_used IS NOT NULL;

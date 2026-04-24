-- Migration: Add optional audio support
-- Description: Make audio summaries optional. Users can toggle audio on/off in their profile.
-- Videos marked "completed" as soon as text summary is ready (before TTS).
-- Audio processing tracked separately via audio_status field.
-- Deliveries flag indicates if audio is required for that delivery.

-- 1. Profile preference for audio
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS audio_enabled boolean NOT NULL DEFAULT true;

-- 2. Audio processing status on videos (null = legacy, pending, processing, completed, failed, skipped)
ALTER TABLE processed_videos ADD COLUMN IF NOT EXISTS audio_status text;

-- 3. Flag on deliveries to know if audio is needed for this delivery
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS audio_required boolean NOT NULL DEFAULT true;

-- 4. Backfill existing completed videos
UPDATE processed_videos SET audio_status = 'completed' WHERE status = 'completed' AND audio_url IS NOT NULL AND audio_status IS NULL;

-- 5. Index for querying audio status efficiently
CREATE INDEX IF NOT EXISTS idx_processed_videos_audio_status ON processed_videos (audio_status) WHERE audio_status IS NOT NULL;

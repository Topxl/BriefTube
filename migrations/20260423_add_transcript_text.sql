-- Persist the raw transcript (Whisper or youtube_api extraction) alongside the
-- summary so the extension's Transcript tab works on videos without YouTube
-- captions. Worker already archives these JSONs to disk — this column makes
-- them reachable via the Supabase API.
ALTER TABLE processed_videos
  ADD COLUMN IF NOT EXISTS transcript_text text;

COMMENT ON COLUMN processed_videos.transcript_text IS
  'Full raw transcript. Populated after Whisper or YouTube transcript extraction. Consumed by the Chrome extension Transcript tab and future features.';

-- Index processed_videos(created_at) to fix the RSS-scanner statement timeout.
--
-- rss_scanner.scan_all_channels() calls get_recent_titles_by_channel(hours=2),
-- which runs `... WHERE created_at >= now() - interval '2 hours'`. With no index
-- on created_at this was a full sequential scan of ~49k rows on every RSS cycle,
-- and on the Supabase Free "Nano" compute it hit `canceling statement due to
-- statement timeout`, which cascaded into the worker treating Supabase as
-- unreachable. The index turns that query into a sub-millisecond range scan.
--
-- Applied to production directly on 2026-07-08 (CONCURRENTLY, no lock).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_videos_created_at
    ON public.processed_videos (created_at DESC);

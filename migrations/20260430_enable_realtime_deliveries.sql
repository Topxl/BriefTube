-- Enable Supabase Realtime on deliveries + processed_videos.
-- Applied via Supabase MCP on 2026-04-30.
--
-- Until now, the dashboard summaries-feed.tsx subscribed to postgres_changes
-- on these tables but never received events because they weren't in the
-- supabase_realtime publication. As a result:
--   - Summarize-via-URL didn't update the feed automatically (Bug 1)
--   - Summary status updates (pending → completed) weren't reflected live
--   - Users had to refresh the page to see new content
--
-- Adding both tables to the publication lets the existing listeners fire,
-- plus the new INSERT-on-deliveries listener that reloads the feed when the
-- worker creates a delivery row for the user.

ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE processed_videos;

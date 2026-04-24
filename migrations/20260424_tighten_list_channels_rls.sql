-- Tighten list_channels SELECT policy to only expose channels of public lists.
-- Before: USING (true) — exposes channels of private lists (none today, but keeps
-- the door shut if we ever ship private-list feature).
-- After: join on channel_lists.is_public OR owner can see their own private list channels.

-- NOTE: the original policy is named with spaces, not underscores. Drop both
-- spellings so this migration stays idempotent regardless of which name is in
-- the live DB.
DROP POLICY IF EXISTS "public read via list" ON list_channels;
DROP POLICY IF EXISTS "public_read_via_list" ON list_channels;

CREATE POLICY "list_channels_public_via_list" ON list_channels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_lists
      WHERE channel_lists.id = list_channels.list_id
      AND channel_lists.is_public = true
    )
    OR (
      -- List creator sees their own private list channels too
      EXISTS (
        SELECT 1 FROM channel_lists
        WHERE channel_lists.id = list_channels.list_id
        AND channel_lists.created_by = auth.uid()
      )
    )
  );

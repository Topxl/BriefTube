-- Track which calendar days each user has been active on the site.
-- Filled by `POST /api/heartbeat` on every dashboard mount (idempotent UPSERT
-- keyed on (user_id, day) so multiple visits per day collapse to one row).
-- Drives the streak in the StatsSheet.

CREATE TABLE IF NOT EXISTS public.user_active_days (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_user_active_days_user_day_desc
  ON public.user_active_days (user_id, day DESC);

ALTER TABLE public.user_active_days ENABLE ROW LEVEL SECURITY;

-- A user can read their own active days (StatsSheet streak query).
DROP POLICY IF EXISTS user_active_days_select_own ON public.user_active_days;
CREATE POLICY user_active_days_select_own
  ON public.user_active_days
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- All writes go through the API (service role); no direct INSERT/UPDATE/DELETE
-- from the authenticated client. This prevents users from inflating their own streak.

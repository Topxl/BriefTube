-- RPC for the StatsSheet: returns the distinct-video counts for a user.
-- Avoids double-counting videos delivered on multiple platforms / in multiple
-- languages (each platform+language pair is its own row in `deliveries`).

CREATE OR REPLACE FUNCTION public.get_user_summary_counts(user_id_in uuid)
RETURNS TABLE (total bigint, this_month bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COUNT(DISTINCT video_id) AS total,
    COUNT(DISTINCT video_id) FILTER (
      WHERE date_trunc('month', sent_at) = date_trunc('month', now())
    ) AS this_month
  FROM deliveries
  WHERE user_id = user_id_in AND status = 'sent';
$$;

GRANT EXECUTE ON FUNCTION public.get_user_summary_counts(uuid) TO authenticated;

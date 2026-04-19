CREATE TABLE IF NOT EXISTS abandoned_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL UNIQUE,
  plan text,
  interval text,
  amount_total integer,
  currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  recovered_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_user_id
  ON abandoned_checkouts(user_id);

CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_created_pending
  ON abandoned_checkouts(created_at)
  WHERE recovered_at IS NULL;

ALTER TABLE abandoned_checkouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own abandoned checkouts"
  ON abandoned_checkouts FOR SELECT
  USING (auth.uid() = user_id);

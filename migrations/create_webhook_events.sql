CREATE TABLE webhook_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processed',
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_webhook_events_created_at ON webhook_events (created_at DESC);
CREATE INDEX idx_webhook_events_type ON webhook_events (event_type);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access, no user policies needed

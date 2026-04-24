-- One-time handoff codes for the extension sign-in bridge.
--
-- Before: /extension/auth rendered access_token + refresh_token as data-*
-- attributes on a hidden <div>. Any other extension the user had installed
-- with host_permissions on brief-tube.com could read them.
--
-- After: we encrypt the tokens, store them here under a short random code,
-- and render only the code. The extension POSTs the code to
-- /api/extension/auth/exchange which decrypts and returns the tokens once,
-- then marks the row used. Race window drops from "indefinite passive read"
-- to "whoever exchanges first", and we can revoke unused codes on logout.
--
-- Ciphertext is AES-256-GCM with the same YOUTUBE_TOKEN_KEY we already use
-- for YouTube refresh tokens (see src/lib/crypto/secret-box.ts).

CREATE TABLE IF NOT EXISTS extension_auth_handoffs (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extension_auth_handoffs_expires_at
  ON extension_auth_handoffs(expires_at);

ALTER TABLE extension_auth_handoffs ENABLE ROW LEVEL SECURITY;
-- No policies → deny-all for clients. The exchange endpoint uses the
-- service role to read and mark rows used.

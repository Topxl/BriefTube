-- Make 'auto' the default summary_length_pref and migrate existing 'standard'
-- users to it. Applied via Supabase MCP on 2026-04-28.
--
-- Migration steps:
--  1. Extend the CHECK constraint to allow 'auto' (was: brief|standard|detailed)
--  2. UPDATE: 260 users currently on 'standard' → 'auto'
--  3. Set the column default to 'auto' for new profiles
--
-- 'brief' (2 users) and 'detailed' (1 user) are kept as-is — explicit choices.
-- See worker/gemini_api.py + src/lib/summary-prompt.ts for the auto formula
-- (target = transcript_words * 18%, bounded [150, 1200] words = 1-8 min audio).

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_summary_length_pref_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_summary_length_pref_check
CHECK (summary_length_pref = ANY (ARRAY['brief', 'standard', 'detailed', 'auto']));

UPDATE profiles
SET summary_length_pref = 'auto'
WHERE summary_length_pref = 'standard';

ALTER TABLE profiles
ALTER COLUMN summary_length_pref SET DEFAULT 'auto';

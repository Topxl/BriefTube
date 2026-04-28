-- The extension no longer supports unauthenticated summaries. The anonymous
-- quota was trivially bypassable (clear chrome.storage → reset device_id) so
-- the entire surface is removed: extension/summarize and /me now require auth.
DROP FUNCTION IF EXISTS increment_extension_anon_usage(text, text, text, text);
DROP TABLE IF EXISTS extension_anon_usage;

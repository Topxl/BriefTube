-- Backfill onboarding_completed for users on the happy path.
--
-- Bug history: until 2026-04-30, the flag was only set client-side when a user
-- clicked "Skip" inside the dashboard onboarding banner. Users who actually
-- followed the happy path (imported channels + connected a delivery platform)
-- were never marked complete in DB. This corrupts the funnel KPI and leaves
-- downstream segments stuck on `onboarding_completed=false` forever.
--
-- This migration retro-fixes every user who has at least one channel (or list
-- follow) and at least one connected delivery platform.

UPDATE public.profiles p
SET onboarding_completed = true
WHERE COALESCE(p.onboarding_completed, false) = false
  AND EXISTS (
    SELECT 1
    FROM public.platform_connections pc
    WHERE pc.user_id = p.id
      AND pc.connected = true
  )
  AND (
    EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.user_id = p.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.list_follows lf
      WHERE lf.user_id = p.id
    )
  );

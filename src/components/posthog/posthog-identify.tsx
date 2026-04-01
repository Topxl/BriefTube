"use client";

import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export function PostHogIdentify() {
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      // Fetch profile for richer person properties
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "subscription_status, trial_ends_at, max_channels, telegram_connected, onboarding_completed",
        )
        .eq("id", user.id)
        .single();

      const wasAnonymous = posthog.get_distinct_id() !== user.id;

      posthog.identify(user.id, {
        email: user.email,
        created_at: user.created_at,
        plan: profile?.subscription_status,
        trial_ends_at: profile?.trial_ends_at,
        max_channels: profile?.max_channels,
        telegram_connected: profile?.telegram_connected,
        onboarding_completed: profile?.onboarding_completed,
      });

      // Group by plan for aggregate analytics
      if (profile?.subscription_status) {
        posthog.group("plan", profile.subscription_status);
      }

      // Re-capture the current pageview now that the person is identified,
      // because $pageview fired before identify() resolved (async Supabase call).
      if (wasAnonymous) {
        posthog.capture("$pageview", { $current_url: window.location.href });
      }
    });
  }, []);

  return null;
}

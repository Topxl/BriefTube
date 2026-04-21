"use client";

import { ensurePostHogInit, getPostHogInstance } from "@/lib/posthog/client";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export function PostHogIdentify() {
  useEffect(() => {
    ensurePostHogInit();
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "subscription_status, trial_ends_at, max_channels, telegram_connected, onboarding_completed",
        )
        .eq("id", user.id)
        .single();

      const posthog = getPostHogInstance();
      if (!posthog) return;

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

      if (profile?.subscription_status) {
        posthog.group("plan", profile.subscription_status);
      }

      if (wasAnonymous) {
        posthog.capture("$pageview", { $current_url: window.location.href });
      }
    });
  }, []);

  return null;
}

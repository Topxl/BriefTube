"use client";

import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export function PostHogIdentify() {
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const wasAnonymous = posthog.get_distinct_id() !== user.id;
      posthog.identify(user.id, { email: user.email });
      // Re-capture the current pageview now that the person is identified,
      // because $pageview fired before identify() resolved (async Supabase call).
      if (wasAnonymous) {
        posthog.capture("$pageview", { $current_url: window.location.href });
      }
    });
  }, []);

  return null;
}

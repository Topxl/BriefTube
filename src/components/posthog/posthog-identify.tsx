"use client";

import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export function PostHogIdentify() {
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !posthog.__loaded) return;
      posthog.identify(user.id, { email: user.email });
    });
  }, []);

  return null;
}

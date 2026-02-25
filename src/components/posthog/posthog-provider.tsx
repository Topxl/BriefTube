"use client";

import posthog from "posthog-js";
import { useEffect, type PropsWithChildren } from "react";

export function PostHogProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      persistence: "localStorage",
    });
  }, []);

  return <>{children}</>;
}

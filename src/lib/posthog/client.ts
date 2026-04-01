import posthog from "posthog-js";

export const posthogClient = posthog;

// Initialize PostHog once on the client side
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY &&
  !posthog.__loaded
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/a",
    ui_host: "https://us.posthog.com",
    capture_pageview: false, // We handle this manually in PostHogPageView
    capture_pageleave: true,
    autocapture: true,
    opt_in_site_apps: true, // Required for PostHog surveys to render
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-mask]",
    },
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug();
    },
  });
}

export function capture(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}

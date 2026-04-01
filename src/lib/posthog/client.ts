import posthog from "posthog-js";

export const posthogClient = posthog;

let initialized = false;

export function ensurePostHogInit(): void {
  if (
    initialized ||
    typeof window === "undefined" ||
    !process.env.NEXT_PUBLIC_POSTHOG_KEY
  ) {
    return;
  }
  initialized = true;
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/a",
    ui_host: "https://us.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    opt_in_site_apps: true,
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
  ensurePostHogInit();
  posthog.capture(event, properties);
}

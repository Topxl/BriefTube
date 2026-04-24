import type { PostHog } from "posthog-js";

let posthogInstance: PostHog | null = null;
let initPromise: Promise<PostHog | null> | null = null;

async function loadPostHog(): Promise<PostHog | null> {
  if (posthogInstance) return posthogInstance;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (typeof window === "undefined" || !key) {
    return null;
  }
  if (initPromise) return initPromise;

  // Disable session recording on public pages (landing, pricing, blog…) — saves
  // ~50 KiB of `posthog-recorder.js` for visitors who aren't logged in. The
  // dashboard tree explicitly re-enables it via `posthog.startSessionRecording()`.
  const isPublicPage = !window.location.pathname.startsWith("/dashboard");

  initPromise = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/a",
      ui_host: "https://us.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: true,
      opt_in_site_apps: true,
      disable_session_recording: isPublicPage,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "[data-mask]",
      },
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") ph.debug();
      },
    });
    posthogInstance = posthog;
    return posthog;
  });

  return initPromise;
}

export function ensurePostHogInit(): void {
  void loadPostHog();
}

export function getPostHogInstance(): PostHog | null {
  return posthogInstance;
}

export function capture(
  event: string,
  properties?: Record<string, unknown>,
): void {
  // Fire-and-forget: load posthog if not yet loaded, then capture.
  // Callers don't await — keeps the existing sync API used across the app.
  void loadPostHog().then((ph) => ph?.capture(event, properties));
}

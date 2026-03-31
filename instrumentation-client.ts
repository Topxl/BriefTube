import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (!key) throw new Error("NEXT_PUBLIC_POSTHOG_KEY is not set");

posthog.init(key, {
  api_host: "/a",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  capture_pageview: false, // handled manually via PostHogPageView (App Router)
  capture_pageleave: true,
  request_batching: true,
  // Disable heavy optional features to reduce third-party JS (~128 KiB)
  disable_session_recording: true,
  disable_surveys: true,
  capture_dead_clicks: false,
  loaded: (ph) => {
    // Force-disable after server-side config is applied (project config may override init options)
    ph.set_config({ capture_dead_clicks: false });
  },
});

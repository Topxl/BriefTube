import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (!key) throw new Error("NEXT_PUBLIC_POSTHOG_KEY is not set");

posthog.init(key, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: "2026-01-30",
  capture_pageview: false, // handled manually via PostHogPageView (App Router)
  capture_pageleave: true,
});

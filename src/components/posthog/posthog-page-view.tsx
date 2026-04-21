"use client";

import { capture, ensurePostHogInit } from "@/lib/posthog/client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

function runWhenIdle(cb: () => void) {
  if (typeof window === "undefined") return;
  const w = window as IdleWindow;
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(cb, { timeout: 4000 });
  } else {
    setTimeout(cb, 2000);
  }
}

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    runWhenIdle(() => {
      ensurePostHogInit();
      capture("$pageview", { $current_url: window.location.href });
    });
  }, [pathname, searchParams]);

  return null;
}

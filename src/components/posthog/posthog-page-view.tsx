"use client";

import { posthogClient as posthog } from "@/lib/posthog/client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname, searchParams]);

  return null;
}

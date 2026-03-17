"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

/**
 * Reads the ?video=<video_id> search param and dispatches the
 * summariesHighlight event so SummariesFeed promotes that video to the top.
 * Cleans the URL immediately to avoid re-triggering on refresh.
 */
export function VideoHighlighter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const videoId = searchParams.get("video");

  useEffect(() => {
    if (!videoId) return;

    // Clean URL right away
    router.replace(pathname, { scroll: false });

    // Delay slightly so SummariesFeed has time to mount and subscribe
    const timer = setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("summariesHighlight", { detail: { videoId } }),
      );
    }, 800);

    return () => clearTimeout(timer);
  }, [videoId, router, pathname]);

  return null;
}

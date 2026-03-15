"use client";

import { useEffect } from "react";
import {
  addProcessingVideo,
  getProcessingVideos,
} from "@/lib/processing-videos";

export function PendingVideoProcessor() {
  useEffect(() => {
    const raw = localStorage.getItem("pendingVideo");
    if (!raw) return;

    let videoId: string | undefined;
    try {
      const parsed = JSON.parse(raw) as { videoId?: string };
      videoId = parsed.videoId;
    } catch {
      localStorage.removeItem("pendingVideo");
      return;
    }

    if (!videoId) {
      localStorage.removeItem("pendingVideo");
      return;
    }

    localStorage.removeItem("pendingVideo");

    const id = videoId;

    // Add immediately with videoId as placeholder title, then enrich with real title
    addProcessingVideo({ videoId: id, title: id, startedAt: Date.now() });

    void (async () => {
      // Fetch real title via link-preview (server-side oEmbed)
      try {
        const res = await fetch(
          `/api/link-preview?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
        );
        const data = (await res.json()) as { title?: string };
        if (data.title) {
          // Preserve original startedAt when updating the title
          const existing = getProcessingVideos().find((v) => v.videoId === id);
          addProcessingVideo({
            videoId: id,
            title: data.title,
            startedAt: existing?.startedAt ?? Date.now(),
          });
        }
      } catch {
        /* keep videoId as title */
      }

      // Queue for processing (with best title we have)
      await fetch("/api/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: id }),
      });
    })();
  }, []);

  return null;
}

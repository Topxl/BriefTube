"use client";

import { useEffect } from "react";
import { addProcessingVideo } from "@/lib/processing-videos";

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
    addProcessingVideo({ videoId: id, title: id, startedAt: Date.now() });

    void fetch("/api/process-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: id }),
    });
  }, []);

  return null;
}

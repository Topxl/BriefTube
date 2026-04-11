"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  addProcessingVideo,
  removeProcessingVideo,
} from "@/lib/processing-videos";

type SummarizeParams = {
  /** Raw video ID or any YouTube URL — normalized server-side */
  videoId: string;
  videoTitle?: string;
  /** Target summary language (ISO code) */
  language?: string;
};

type SummarizeResponse = {
  ok?: boolean;
  queued?: boolean;
  videoId?: string;
  videoTitle?: string;
  error?: string;
};

type Options = {
  /**
   * Custom toast text. Set to `false` to suppress toasts entirely.
   * Use when the caller wants to handle UX feedback differently.
   */
  toasts?:
    | false
    | {
        queued?: string;
        alreadyProcessed?: string;
        failed?: string;
        network?: string;
      };
  /**
   * Whether to add the video to the global processing state (for the processing card).
   * Default: true.
   */
  trackProcessing?: boolean;
  /** Called after a successful response */
  onSuccess?: (data: { queued: boolean }) => void;
  /** Called after a failed response */
  onError?: (error: string) => void;
};

const DEFAULT_TOASTS = {
  queued: "Summary requested — processing started",
  alreadyProcessed: "Video already summarized",
  failed: "Failed to start summary",
  network: "Network error",
};

/**
 * Centralized hook for summarizing a YouTube video.
 *
 * Handles:
 * - POST /api/process-video with normalized body
 * - Adding to the global processing state (ProcessingVideoCard)
 * - Toast notifications (customizable)
 * - Error handling
 *
 * Used by: search bar, summary-row retry, video-inbox-row, pending processor, sources-section, etc.
 */
export function useSummarizeVideo() {
  const [loading, setLoading] = useState(false);

  const summarize = useCallback(
    async (
      params: SummarizeParams,
      options: Options = {},
    ): Promise<SummarizeResponse | null> => {
      const { videoId, videoTitle, language } = params;
      const {
        toasts = {},
        trackProcessing = true,
        onSuccess,
        onError,
      } = options;

      const toastText =
        toasts === false
          ? null
          : { ...DEFAULT_TOASTS, ...(toasts as Record<string, string>) };

      setLoading(true);

      // Optimistic: show processing card immediately with best available title
      if (trackProcessing) {
        addProcessingVideo({
          videoId,
          title: videoTitle ?? videoId,
          startedAt: Date.now(),
        });
      }

      try {
        const res = await fetch("/api/process-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId,
            ...(videoTitle ? { videoTitle } : {}),
            ...(language ? { language } : {}),
          }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          const msg = err.error ?? toastText?.failed ?? "Failed";
          if (toastText) toast.error(msg);
          onError?.(msg);
          return null;
        }

        const data = (await res.json()) as SummarizeResponse;

        if (data.queued && trackProcessing) {
          // Update the optimistic card with the resolved title from the API
          const resolvedTitle =
            (data.videoTitle && data.videoTitle !== (data.videoId ?? videoId)
              ? data.videoTitle
              : null) ??
            (videoTitle && videoTitle !== videoId ? videoTitle : null) ??
            videoId;
          addProcessingVideo({
            videoId: data.videoId ?? videoId,
            title: resolvedTitle,
            startedAt: Date.now(),
          });
        } else if (!data.queued && trackProcessing) {
          // Not queued (already processed): remove the optimistic card
          removeProcessingVideo(videoId);
        }

        if (toastText) {
          if (data.queued) {
            toast.success(toastText.queued);
          } else {
            toast.info(toastText.alreadyProcessed);
          }
        }

        onSuccess?.({ queued: data.queued ?? false });
        return data;
      } catch {
        const msg = toastText?.network ?? "Network error";
        if (toastText) toast.error(msg);
        onError?.(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { summarize, loading };
}

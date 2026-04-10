"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { addProcessingVideo } from "@/lib/processing-videos";
import { extractVideoId } from "@/lib/youtube-id";

const COOKIE_NAME = "bt_pending_url";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * On mount, checks for a bt_pending_url cookie left by the landing page
 * hero input. If found:
 *   - If it contains a video ID: auto-queues processing + shows card
 *   - If it's a channel URL/handle: subscribes to the channel
 * Then clears the cookie. Renders nothing visible.
 */
export function PendingVideoPickup() {
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    const url = getCookie(COOKIE_NAME);
    if (!url) return;

    triggered.current = true;
    deleteCookie(COOKIE_NAME);

    // Try to extract a video ID first
    const videoId = extractVideoId(url);

    if (videoId) {
      // It's a video URL: queue for processing
      toast.info("Processing your video...");

      // Show the card immediately with videoId as placeholder title
      addProcessingVideo({
        videoId,
        title: videoId,
        startedAt: Date.now(),
      });

      void fetch("/api/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: url }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            toast.error(data.error ?? "Could not process that video");
            return;
          }
          const data = (await res.json().catch(() => ({}))) as {
            videoTitle?: string;
            videoId?: string;
          };
          // Update the processing card with the real title
          if (data.videoTitle && data.videoTitle !== videoId) {
            addProcessingVideo({
              videoId: data.videoId ?? videoId,
              title: data.videoTitle,
              startedAt: Date.now(),
            });
          }
          toast.success("Video queued! The summary will appear shortly.");
        })
        .catch(() => {
          toast.error("Could not process that video.");
        });
    } else {
      // It's likely a channel URL or @handle: subscribe to the channel
      toast.info("Adding channel...");

      void fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            channelName?: string;
            videoId?: string;
            videoTitle?: string;
          };
          if (!res.ok) {
            toast.error(data.error ?? "Could not add that channel");
            return;
          }
          toast.success(
            data.channelName
              ? `${data.channelName} added! New videos will be summarized automatically.`
              : "Channel added!",
          );
          // If the API returned a latest video to process, track it
          if (data.videoId) {
            addProcessingVideo({
              videoId: data.videoId,
              title: data.videoTitle ?? data.videoId,
              startedAt: Date.now(),
            });
          }
          // Refresh to show the new channel
          window.location.reload();
        })
        .catch(() => {
          toast.error("Could not add that channel.");
        });
    }
  }, []);

  return null;
}

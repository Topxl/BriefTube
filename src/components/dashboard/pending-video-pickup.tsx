"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

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
 * hero input. If found, auto-triggers video processing and clears the cookie.
 * Renders nothing visible.
 */
export function PendingVideoPickup() {
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    const url = getCookie(COOKIE_NAME);
    if (!url) return;

    triggered.current = true;
    deleteCookie(COOKIE_NAME);

    toast.info("Processing your video...");

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
        toast.success("Video queued! You'll see the summary shortly.");
      })
      .catch(() => {
        toast.error("Could not process that video. Try pasting it above.");
      });
  }, []);

  return null;
}

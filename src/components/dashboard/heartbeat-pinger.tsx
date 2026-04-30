"use client";

import { useEffect } from "react";

const STORAGE_KEY = "brieftube:last-heartbeat-day";

/**
 * Records "today" as an active day for the signed-in user. Hits the heartbeat
 * endpoint once per UTC day per browser — the localStorage guard avoids
 * spamming the API when the user navigates inside the dashboard.
 *
 * Mounted once in the dashboard layout so it covers every dashboard sub-route.
 */
export function HeartbeatPinger() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === today) return;

    void fetch("/api/heartbeat", {
      method: "POST",
      credentials: "same-origin",
      // Beacon-like: don't await, don't block, swallow errors.
    })
      .then((res) => {
        if (res.ok) {
          window.localStorage.setItem(STORAGE_KEY, today);
        }
      })
      .catch(() => {
        // Swallow — heartbeat failures are non-critical.
      });
  }, []);

  return null;
}

"use client";

import { useSyncExternalStore } from "react";
import { Zap } from "@/lib/icons";
import { Banner } from "@/components/nowts/banner";

const STORAGE_KEY = "activation-banner-dismissed-at";
const REDISPLAY_MS = 24 * 60 * 60 * 1000; // 24 hours

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

// Returns true if the user dismissed recently (within REDISPLAY_MS)
function getSnapshot() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  return Date.now() - parseInt(raw, 10) < REDISPLAY_MS;
}

function getServerSnapshot() {
  return false;
}

export function ActivationBanner({
  hasConnection,
}: {
  hasConnection: boolean;
}) {
  const recentlyDismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Only show if no delivery channel is connected
  if (hasConnection) return null;

  // Allow dismiss, but redisplay after 24h
  const isDismissed = recentlyDismissed;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch {
      // localStorage unavailable
    }
  };

  if (isDismissed) return null;

  return (
    <Banner
      variant="warning"
      icon={<Zap className="h-3.5 w-3.5 text-amber-400/70" />}
      title="Quick action needed"
      description="Connect Discord, Slack, Telegram, or your podcast app to start receiving summaries"
      action={{ label: "Connect now", href: "/dashboard/profile" }}
      onDismiss={dismiss}
    />
  );
}

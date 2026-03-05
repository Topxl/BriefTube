"use client";

import { useSyncExternalStore } from "react";
import { Clock } from "@/lib/icons";
import { Banner } from "@/components/nowts/banner";

const STORAGE_KEY = "trial-banner-dismissed-at";
const REDISPLAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const URGENT_DAYS = 3; // always show in the last 3 days regardless of dismiss

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

export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const recentlyDismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const isDismissed = daysLeft > URGENT_DAYS && recentlyDismissed;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      // Dispatch storage event so useSyncExternalStore re-reads the snapshot
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch {
      // localStorage unavailable — ignore
    }
  };

  if (daysLeft <= 0 || isDismissed) return null;

  const isUrgent = daysLeft <= URGENT_DAYS;

  const message =
    daysLeft === 1
      ? "Last day — your Telegram summaries stop tomorrow"
      : daysLeft <= 3
        ? `Only ${daysLeft} days left — upgrade to keep your summaries`
        : `${daysLeft} days left in your Pro trial`;

  return (
    <Banner
      variant={isUrgent ? "danger" : "warning"}
      icon={
        <Clock
          className={`h-3.5 w-3.5 ${isUrgent ? "text-red-400/70" : "text-amber-300/70"}`}
        />
      }
      title={isUrgent ? "Urgent:" : "Trial:"}
      description={message}
      action={{ label: "Upgrade", href: "/dashboard/billing?annual=true" }}
      onDismiss={dismiss}
    />
  );
}

"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "@/lib/icons";

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

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/[0.15] bg-amber-500/[0.04] py-1.5 pr-1 pl-3">
      <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
        <span className="font-medium text-amber-300/90">
          {daysLeft === 1 ? "Last day" : `${daysLeft} days`}
        </span>{" "}
        left in your Pro trial
      </p>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 shrink-0 px-2 text-xs text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300"
        asChild
      >
        <Link href="/dashboard/billing">Upgrade</Link>
      </Button>
      <button
        onClick={dismiss}
        className="text-muted-foreground/30 hover:text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-white/[0.06]"
        title="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

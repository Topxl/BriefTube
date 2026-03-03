"use client";

import { useSyncExternalStore, useState } from "react";
import { Bell, X } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { subscribeToPush } from "@/lib/push/use-push-subscription";
import { toast } from "sonner";

const STORAGE_KEY = "push_banner_dismissed";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot() {
  return true; // SSR: toujours caché, évite le flash
}

function getPermissionSnapshot() {
  if (typeof window === "undefined" || !("Notification" in window))
    return "denied";
  return Notification.permission;
}

export function PushNotificationBanner() {
  const dismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const [permission, setPermission] = useState<NotificationPermission>(
    getPermissionSnapshot,
  );
  const [loading, setLoading] = useState(false);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch {
      // localStorage unavailable
    }
  };

  const enable = async () => {
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await subscribeToPush();
        toast.success("Browser notifications enabled");
        dismiss();
      }
    } catch {
      toast.error("Could not enable notifications");
    } finally {
      setLoading(false);
    }
  };

  // Masqué si : SSR, déjà refusé, déjà accordé, ou banner dismissé
  if (dismissed || permission !== "default") return null;

  return (
    <div className="nm-raised flex items-center gap-2 rounded-2xl bg-blue-500/[0.06] py-1.5 pr-1 pl-3">
      <Bell className="h-3.5 w-3.5 shrink-0 text-blue-400/70" />
      <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
        <span className="font-medium text-blue-300/90">Notifications:</span> Get
        notified the instant a new summary is ready
      </p>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 shrink-0 px-2 text-xs text-blue-400/80 hover:bg-blue-500/10 hover:text-blue-300"
        onClick={enable}
        disabled={loading}
      >
        Enable
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

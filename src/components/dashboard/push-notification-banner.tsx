"use client";

import { useSyncExternalStore, useState } from "react";
import { Bell } from "@/lib/icons";
import { Banner } from "@/components/nowts/banner";
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
    <Banner
      variant="info"
      icon={<Bell className="h-3.5 w-3.5 text-blue-400/70" />}
      title="Notifications:"
      description="Get notified the instant a new summary is ready"
      action={{ label: "Enable", onClick: enable, loading }}
      onDismiss={dismiss}
    />
  );
}

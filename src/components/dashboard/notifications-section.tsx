"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Bell, BellOff, Clock, Mail, Megaphone } from "@/lib/icons";
import {
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/use-push-subscription";

type Props = {
  initialPushEnabled: boolean;
  initialNewsletter: boolean;
  initialAnnouncements: boolean;
  initialDailyDigest: boolean;
  initialDigestHour: number;
};

export function NotificationsSection({
  initialPushEnabled,
  initialNewsletter,
  initialAnnouncements,
  initialDailyDigest,
  initialDigestHour,
}: Props) {
  const supabase = createClient();
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [newsletter, setNewsletter] = useState(initialNewsletter);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [dailyDigest, setDailyDigest] = useState(initialDailyDigest);
  const [digestHour, setDigestHour] = useState(initialDigestHour);
  const [savingPush, setSavingPush] = useState(false);
  const [savingNewsletter, setSavingNewsletter] = useState(false);
  const [savingAnnouncements, setSavingAnnouncements] = useState(false);
  const [savingDigest, setSavingDigest] = useState(false);

  const permissionDenied =
    typeof Notification !== "undefined" && Notification.permission === "denied";

  const handlePushToggle = async (checked: boolean) => {
    setSavingPush(true);
    try {
      if (checked) {
        if (typeof Notification === "undefined") {
          toast.error("Browser notifications are not supported.");
          return;
        }
        if (Notification.permission === "denied") {
          toast.error(
            "Notifications are blocked. Allow them in your browser settings.",
          );
          return;
        }
        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            toast.error("Notification permission denied.");
            return;
          }
        }
        await subscribeToPush();
        setPushEnabled(true);
        toast.success("Browser notifications enabled.");
      } else {
        await unsubscribeFromPush();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .update({ notify_new_summaries_push: false })
            .eq("id", user.id);
        }
        setPushEnabled(false);
        toast.success("Browser notifications disabled.");
      }
    } catch {
      toast.error("Failed to update notification settings.");
    } finally {
      setSavingPush(false);
    }
  };

  const handleNewsletterToggle = async (checked: boolean) => {
    setSavingNewsletter(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ email_newsletter: checked })
        .eq("id", user.id);
      setNewsletter(checked);
      toast.success(checked ? "Newsletter enabled." : "Newsletter disabled.");
    } catch {
      toast.error("Failed to update newsletter preference.");
    } finally {
      setSavingNewsletter(false);
    }
  };

  const handleAnnouncementsToggle = async (checked: boolean) => {
    setSavingAnnouncements(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ email_announcements: checked })
        .eq("id", user.id);
      setAnnouncements(checked);
      toast.success(
        checked ? "Announcements enabled." : "Announcements disabled.",
      );
    } catch {
      toast.error("Failed to update announcement preference.");
    } finally {
      setSavingAnnouncements(false);
    }
  };

  const handleDailyDigestToggle = async (checked: boolean) => {
    setSavingDigest(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ newsletter_enabled: checked })
        .eq("id", user.id);
      setDailyDigest(checked);
      toast.success(
        checked ? "Daily digest enabled." : "Daily digest disabled.",
      );
    } catch {
      toast.error("Failed to update daily digest preference.");
    } finally {
      setSavingDigest(false);
    }
  };

  const handleDigestHourChange = async (hour: number) => {
    setDigestHour(hour);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ newsletter_hour: hour })
        .eq("id", user.id);
    } catch {
      toast.error("Failed to update delivery time.");
    }
  };

  // Format hour as "8:00", "14:00" etc.
  const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00 UTC`;

  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
        Notifications
      </h2>

      <div className="nm-raised divide-y divide-white/[0.05] overflow-hidden rounded-2xl">
        {/* Browser push */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              {permissionDenied ? (
                <BellOff className="text-muted-foreground h-4 w-4" />
              ) : (
                <Bell
                  className={`h-4 w-4 ${pushEnabled ? "text-red-400" : "text-muted-foreground"}`}
                />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">Browser notifications</p>
              <p className="text-muted-foreground text-[11px]">
                {permissionDenied
                  ? "Blocked in browser settings"
                  : "Instant alert when a new summary is ready"}
              </p>
            </div>
          </div>
          <Switch
            checked={pushEnabled && !permissionDenied}
            disabled={savingPush || permissionDenied}
            onCheckedChange={(checked) => void handlePushToggle(checked)}
          />
        </div>

        {/* Newsletter */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Mail
                className={`h-4 w-4 ${newsletter ? "text-red-400" : "text-muted-foreground"}`}
              />
            </div>
            <div>
              <p className="text-sm font-medium">Newsletter</p>
              <p className="text-muted-foreground text-[11px]">
                Tips and updates about BriefTube
              </p>
            </div>
          </div>
          <Switch
            checked={newsletter}
            disabled={savingNewsletter}
            onCheckedChange={(checked) => void handleNewsletterToggle(checked)}
          />
        </div>

        {/* Announcements */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Megaphone
                className={`h-4 w-4 ${announcements ? "text-red-400" : "text-muted-foreground"}`}
              />
            </div>
            <div>
              <p className="text-sm font-medium">Announcements</p>
              <p className="text-muted-foreground text-[11px]">
                New features and product updates
              </p>
            </div>
          </div>
          <Switch
            checked={announcements}
            disabled={savingAnnouncements}
            onCheckedChange={(checked) =>
              void handleAnnouncementsToggle(checked)
            }
          />
        </div>

        {/* Daily digest */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                <Clock
                  className={`h-4 w-4 ${dailyDigest ? "text-red-400" : "text-muted-foreground"}`}
                />
              </div>
              <div>
                <p className="text-sm font-medium">Daily digest</p>
                <p className="text-muted-foreground text-[11px]">
                  Email summary of your videos every day
                </p>
              </div>
            </div>
            <Switch
              checked={dailyDigest}
              disabled={savingDigest}
              onCheckedChange={(checked) =>
                void handleDailyDigestToggle(checked)
              }
            />
          </div>
          {dailyDigest && (
            <div className="mt-3 flex items-center gap-2 pl-[42px]">
              <p className="text-muted-foreground text-xs">Delivery time</p>
              <select
                value={digestHour}
                onChange={(e) =>
                  void handleDigestHourChange(Number(e.target.value))
                }
                className="nm-inset text-foreground rounded-lg px-2 py-1 text-xs outline-none"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {formatHour(h)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

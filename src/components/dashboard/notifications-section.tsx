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
import { capture } from "@/lib/posthog/client";

type Props = {
  initialPushEnabled: boolean;
  initialNewsletter: boolean;
  initialAnnouncements: boolean;
  initialDailyDigest: boolean;
  initialDigestHour: number;
  initialFullSummary: boolean;
};

export function NotificationsSection({
  initialPushEnabled,
  initialNewsletter,
  initialAnnouncements,
  initialDailyDigest,
  initialDigestHour,
  initialFullSummary,
}: Props) {
  const supabase = createClient();
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [newsletter, setNewsletter] = useState(initialNewsletter);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [dailyDigest, setDailyDigest] = useState(initialDailyDigest);
  // Store and display digest hour in local time; DB stores UTC
  const toLocalHour = (utc: number) =>
    (((utc - new Date().getTimezoneOffset() / 60) % 24) + 24) % 24;
  const toUtcHour = (local: number) =>
    (((local + new Date().getTimezoneOffset() / 60) % 24) + 24) % 24;
  const [digestHour, setDigestHour] = useState(() =>
    toLocalHour(initialDigestHour),
  );
  const [savingPush, setSavingPush] = useState(false);
  const [savingNewsletter, setSavingNewsletter] = useState(false);
  const [savingAnnouncements, setSavingAnnouncements] = useState(false);
  const [fullSummary, setFullSummary] = useState(initialFullSummary);
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
      capture("newsletter_toggled", {
        setting: "email_newsletter",
        enabled: checked,
      });
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
      capture("newsletter_toggled", {
        setting: "email_announcements",
        enabled: checked,
      });
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
      capture("newsletter_toggled", {
        setting: "newsletter_enabled",
        enabled: checked,
      });
    } catch {
      toast.error("Failed to update daily digest preference.");
    } finally {
      setSavingDigest(false);
    }
  };

  const handleDigestHourChange = async (localHour: number) => {
    setDigestHour(localHour);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ newsletter_hour: toUtcHour(localHour) })
        .eq("id", user.id);
    } catch {
      toast.error("Failed to update delivery time.");
    }
  };

  const handleFullSummaryToggle = async (checked: boolean) => {
    setFullSummary(checked);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ newsletter_full_summary: checked })
        .eq("id", user.id);
      toast.success(
        checked
          ? "Full summaries enabled in digest."
          : "Short previews restored in digest.",
      );
    } catch {
      setFullSummary(!checked);
      toast.error("Failed to update preference.");
    }
  };

  const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
        Notifications
      </h2>

      <div className="nm-raised divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
        {/* Browser push */}
        <div className="flex items-center justify-between px-4 py-3.5">
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
                  : "Get notified when a summary is ready"}
              </p>
            </div>
          </div>
          <Switch
            checked={pushEnabled && !permissionDenied}
            disabled={savingPush || permissionDenied}
            onCheckedChange={(checked) => void handlePushToggle(checked)}
            className="data-[state=checked]:bg-emerald-500"
            aria-label="Toggle browser notifications"
          />
        </div>

        {/* Newsletter */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Mail
                className={`h-4 w-4 ${newsletter ? "text-red-400" : "text-muted-foreground"}`}
              />
            </div>
            <div>
              <p className="text-sm font-medium">Newsletter</p>
              <p className="text-muted-foreground text-[11px]">
                Tips and product updates
              </p>
            </div>
          </div>
          <Switch
            checked={newsletter}
            disabled={savingNewsletter}
            onCheckedChange={(checked) => void handleNewsletterToggle(checked)}
            className="data-[state=checked]:bg-emerald-500"
            aria-label="Toggle newsletter emails"
          />
        </div>

        {/* Announcements */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Megaphone
                className={`h-4 w-4 ${announcements ? "text-red-400" : "text-muted-foreground"}`}
              />
            </div>
            <div>
              <p className="text-sm font-medium">Announcements</p>
              <p className="text-muted-foreground text-[11px]">
                New features and releases
              </p>
            </div>
          </div>
          <Switch
            checked={announcements}
            disabled={savingAnnouncements}
            onCheckedChange={(checked) =>
              void handleAnnouncementsToggle(checked)
            }
            className="data-[state=checked]:bg-emerald-500"
            aria-label="Toggle announcement emails"
          />
        </div>

        {/* Daily digest */}
        <div className="px-4 py-3.5">
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
                  Email recap of new summaries
                </p>
              </div>
            </div>
            <Switch
              checked={dailyDigest}
              disabled={savingDigest}
              onCheckedChange={(checked) =>
                void handleDailyDigestToggle(checked)
              }
              className="data-[state=checked]:bg-emerald-500"
              aria-label="Toggle daily digest"
            />
          </div>
          {dailyDigest && (
            <div className="mt-3 flex items-center justify-between pl-[42px]">
              <div className="flex items-center gap-2" suppressHydrationWarning>
                <input
                  type="time"
                  value={`${formatHour(digestHour)}:00`.slice(0, 5)}
                  onChange={(e) => {
                    const hour = parseInt(
                      e.target.value.split(":")[0] ?? "0",
                      10,
                    );
                    if (!isNaN(hour)) void handleDigestHourChange(hour);
                  }}
                  className="nm-inset text-foreground rounded-lg px-2 py-1 text-xs outline-none"
                  aria-label="Digest delivery time"
                />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-muted-foreground text-xs">Full summaries</p>
                <Switch
                  checked={fullSummary}
                  onCheckedChange={(checked) =>
                    void handleFullSummaryToggle(checked)
                  }
                  className="data-[state=checked]:bg-emerald-500"
                  aria-label="Toggle full summaries in digest email"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

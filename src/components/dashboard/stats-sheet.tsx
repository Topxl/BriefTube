"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Flame,
  Clock,
  TrendingUp,
  Trophy,
  Inbox,
  Loader2,
  X,
} from "@/lib/icons";
import { useSession } from "@/lib/auth-client";

type Stats = {
  thisMonth: number;
  total: number;
  timeSaved: string;
  streak: number;
  bestStreak: number;
  topChannels: { name: string; count: number }[];
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeCurrentStreak(engagementDays: Set<string>): number {
  if (engagementDays.size === 0) return 0;

  const sorted = [...engagementDays].sort();
  const mostRecentStr = sorted.at(-1);
  if (!mostRecentStr) return 0;

  const mostRecent = new Date(mostRecentStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (today.getTime() - mostRecent.getTime()) / 86_400_000,
  );

  if (diffDays > 1) return 0;

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(mostRecent);
    d.setDate(d.getDate() - i);
    if (engagementDays.has(toDateStr(d))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function computeBestStreak(engagementDays: Set<string>): number {
  if (engagementDays.size === 0) return 0;

  const sorted = [...engagementDays].sort();
  let best = 1;
  let run = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] ?? "");
    const curr = new Date(sorted[i] ?? "");
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    if (diff === 1) {
      run += 1;
      if (run > best) best = run;
    } else if (diff > 1) {
      run = 1;
    }
  }
  return best;
}

export function StatsSheet() {
  const session = useSession();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const userId = session.data?.user?.id;

  useEffect(() => {
    if (!open || !userId) {
      return;
    }

    const fetchStats = async (): Promise<void> => {
      setLoading(true);
      try {
        const supabase = createClient();

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Distinct-video counts via RPC. We can't do this client-side because
        // (a) Supabase caps row results at 1000 by default and (b) `count: "exact"`
        // counts rows, not distinct video_ids — a user can receive the same
        // video across multiple platforms (Telegram + Discord + email) AND
        // multiple languages, so raw row counts overstate by ~2x.
        const [
          countsRes,
          activeDaysRes,
          { data: deliveries },
          { data: subscriptions },
        ] = await Promise.all([
          // RPC isn't in the generated supabase types yet — cast at the call
          // site rather than regenerating the 52 KB types file.
          (
            supabase.rpc as unknown as (
              fn: string,
              args: { user_id_in: string },
            ) => Promise<{
              data: { total: number; this_month: number } | null;
            }>
          )("get_user_summary_counts", { user_id_in: userId }),
          // Streak is now driven by `user_active_days` (filled by the heartbeat
          // pinger on every dashboard mount), not by `listened_at` — the old
          // signal was always 0 for users who consume on Telegram/Discord/email.
          (
            supabase.from as unknown as (t: string) => {
              select: (cols: string) => {
                eq: (
                  c: string,
                  v: string,
                ) => Promise<{ data: { day: string }[] | null }>;
              };
            }
          )("user_active_days")
            .select("day")
            .eq("user_id", userId),
          // Recent 1000 deliveries are enough to compute the top-5 channels.
          supabase
            .from("deliveries")
            .select("video_id")
            .eq("user_id", userId)
            .eq("status", "sent")
            .order("sent_at", { ascending: false }),
          supabase
            .from("subscriptions")
            .select("channel_id, channel_name")
            .eq("user_id", userId),
        ]);

        const counts = Array.isArray(countsRes.data)
          ? countsRes.data[0]
          : countsRes.data;
        const total = Number(counts?.total ?? 0);
        const thisMonth = Number(counts?.this_month ?? 0);

        if (total === 0) {
          setStats({
            thisMonth: 0,
            total: 0,
            timeSaved: "~0min",
            streak: 0,
            bestStreak: 0,
            topChannels: [],
          });
          setLoading(false);
          return;
        }

        const safeDeliveries = deliveries ?? [];

        const videoIds = [...new Set(safeDeliveries.map((d) => d.video_id))];
        const { data: videos } = videoIds.length
          ? await supabase
              .from("processed_videos")
              .select("video_id, channel_id")
              .in("video_id", videoIds)
          : { data: [] };

        // Streak based on calendar days the user opened the dashboard (sent
        // by `HeartbeatPinger`). Independent of how the user consumes summaries
        // (Telegram, email, web) — what counts is just visiting the site.
        const activeDays = new Set<string>(
          (activeDaysRes.data ?? []).map((r) => r.day),
        );
        const streak = computeCurrentStreak(activeDays);
        const bestStreak = computeBestStreak(activeDays);

        const minutesSaved = total * 10;
        const timeSaved =
          minutesSaved >= 60
            ? `~${Math.round(minutesSaved / 60)}h`
            : `~${minutesSaved}min`;

        const videoToChannel = new Map(
          (videos ?? []).map((v) => [v.video_id, v.channel_id]),
        );
        const channelNameMap = new Map(
          (subscriptions ?? []).map((s) => [s.channel_id, s.channel_name]),
        );

        const channelCounts: Partial<Record<string, number>> = {};
        for (const delivery of safeDeliveries) {
          const channelId = videoToChannel.get(delivery.video_id);
          if (!channelId) continue;
          channelCounts[channelId] = (channelCounts[channelId] ?? 0) + 1;
        }

        const topChannels = Object.entries(channelCounts)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .slice(0, 5)
          .map(([id, count]) => ({
            name: channelNameMap.get(id) ?? id,
            count: count ?? 0,
          }));

        setStats({
          thisMonth,
          total,
          timeSaved,
          streak,
          bestStreak,
          topChannels,
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, [open, userId]);

  // Listen for a global "open-stats" event so the nav dropdown can trigger this
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-stats", handler);
    return () => window.removeEventListener("open-stats", handler);
  }, []);

  if (!session.data?.user) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        showCloseButton={false}
        className={
          isMobile
            ? "h-[85dvh] gap-0 overflow-y-auto p-0"
            : "gap-0 overflow-y-auto p-0 sm:max-w-md"
        }
      >
        <SheetHeader className="border-b border-white/[0.04] px-6 py-2">
          <div className="flex items-center justify-between">
            <SheetTitle>Your stats</SheetTitle>
            <SheetClose className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </SheetClose>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : stats ? (
          <div className="flex flex-col gap-4 px-6 pt-3 pb-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="nm-raised flex flex-col gap-2 rounded-2xl px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">This month</p>
                  <Inbox className="text-muted-foreground/40 h-3 w-3" />
                </div>
                <p className="text-xl font-bold tabular-nums">
                  {stats.thisMonth}
                </p>
              </div>

              <div className="nm-raised flex flex-col gap-2 rounded-2xl px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">All time</p>
                  <TrendingUp className="text-muted-foreground/40 h-3 w-3" />
                </div>
                <p className="text-xl font-bold tabular-nums">{stats.total}</p>
              </div>

              <div className="nm-raised flex flex-col gap-2 rounded-2xl px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">Time saved</p>
                  <Clock className="text-muted-foreground/40 h-3 w-3" />
                </div>
                <p className="text-xl font-bold tabular-nums">
                  {stats.timeSaved}
                </p>
              </div>

              <div className="nm-raised flex flex-col gap-2 rounded-2xl px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">Streak</p>
                  <Flame
                    className={`h-3 w-3 ${stats.streak > 0 ? "text-red-500" : "text-muted-foreground/40"}`}
                  />
                </div>
                <div className="flex items-baseline gap-2">
                  <p
                    className={`text-xl font-bold tabular-nums ${stats.streak > 0 ? "text-red-500" : ""}`}
                  >
                    {stats.streak}
                  </p>
                  {stats.bestStreak > 0 && (
                    <span className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
                      <Trophy className="h-3 w-3" />
                      {stats.bestStreak}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Top channels */}
            {stats.topChannels.length > 0 && (
              <div className="nm-raised overflow-hidden rounded-2xl">
                <div className="border-b border-white/[0.04] px-3 py-2">
                  <p className="text-xs font-medium">Top channels</p>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {stats.topChannels.map((ch, i) => (
                    <div
                      key={ch.name}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-muted-foreground/40 w-4 shrink-0 text-xs tabular-nums">
                          {i + 1}
                        </span>
                        <p className="truncate text-sm">{ch.name}</p>
                      </div>
                      <span className="text-muted-foreground ml-2 shrink-0 text-xs tabular-nums">
                        {ch.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

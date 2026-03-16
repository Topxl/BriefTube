"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  BarChart2,
  Flame,
  Clock,
  TrendingUp,
  Inbox,
  Loader2,
} from "@/lib/icons";
import { useSession } from "@/lib/auth-client";

type Stats = {
  thisMonth: number;
  total: number;
  timeSaved: string;
  streak: number;
  topChannels: { name: string; count: number }[];
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeStreak(deliveryDays: Set<string>): number {
  if (deliveryDays.size === 0) return 0;

  const sorted = [...deliveryDays].sort();
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
    if (deliveryDays.has(toDateStr(d))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function StatsSheet() {
  const session = useSession();
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

        const [{ data: deliveries }, { data: subscriptions }] =
          await Promise.all([
            supabase
              .from("deliveries")
              .select("sent_at, video_id")
              .eq("user_id", userId)
              .eq("status", "sent")
              .order("sent_at", { ascending: false }),
            supabase
              .from("subscriptions")
              .select("channel_id, channel_name")
              .eq("user_id", userId),
          ]);

        if (!deliveries || deliveries.length === 0) {
          setStats({
            thisMonth: 0,
            total: 0,
            timeSaved: "~0min",
            streak: 0,
            topChannels: [],
          });
          setLoading(false);
          return;
        }

        const videoIds = [...new Set(deliveries.map((d) => d.video_id))];
        const { data: videos } = await supabase
          .from("processed_videos")
          .select("video_id, channel_id")
          .in("video_id", videoIds);

        const total = deliveries.length;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const thisMonth = deliveries.filter(
          (d) => d.sent_at != null && new Date(d.sent_at) >= startOfMonth,
        ).length;

        const deliveryDays = new Set(
          deliveries
            .filter((d) => d.sent_at != null)
            .map((d) => toDateStr(new Date(d.sent_at ?? ""))),
        );
        const streak = computeStreak(deliveryDays);

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
        for (const delivery of deliveries) {
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
          topChannels,
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, [open, userId]);

  if (!session.data?.user) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
          <BarChart2 className="h-4 w-4" />
          {stats?.streak && stats.streak > 0 ? (
            <span className="text-xs font-medium text-orange-400">
              {stats.streak}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-white/[0.04] px-6 py-4">
          <SheetTitle>Your stats</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : stats ? (
          <div className="flex flex-col gap-4 p-6">
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
                    className={`h-3 w-3 ${stats.streak > 0 ? "text-orange-400" : "text-muted-foreground/40"}`}
                  />
                </div>
                <p
                  className={`text-xl font-bold tabular-nums ${stats.streak > 0 ? "text-orange-400" : ""}`}
                >
                  {stats.streak}
                </p>
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

import { createClient } from "@/lib/supabase/server";
import { Flame, Inbox, Clock, TrendingUp } from "@/lib/icons";

type Props = {
  userId: string;
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

  // Streak is only "alive" if last delivery was today or yesterday
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

export async function PersonalStats({ userId }: Props) {
  const supabase = await createClient();

  // 1. All sent deliveries for this user
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("sent_at, video_id")
    .eq("user_id", userId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false });

  if (!deliveries || deliveries.length === 0) return null;

  // 2. All user subscriptions (for channel names — includes inactive to avoid falling back to ID)
  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("channel_id, channel_name")
    .eq("user_id", userId);

  // 3. Map video_id → channel_id via processed_videos
  const videoIds = [...new Set(deliveries.map((d) => d.video_id))];
  const { data: videos } = await supabase
    .from("processed_videos")
    .select("video_id, channel_id")
    .in("video_id", videoIds);

  // ── Compute stats ──────────────────────────────────────────────

  const total = deliveries.length;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const thisMonth = deliveries.filter(
    (d) => d.sent_at != null && new Date(d.sent_at) >= startOfMonth,
  ).length;

  // Streak
  const deliveryDays = new Set(
    deliveries
      .filter((d) => d.sent_at != null)
      .map((d) => toDateStr(new Date(d.sent_at ?? ""))),
  );
  const streak = computeStreak(deliveryDays);

  // Time saved — estimate: avg video 12 min, avg summary audio 2 min → 10 min saved per delivery
  const minutesSaved = total * 10;
  const timeSaved =
    minutesSaved >= 60
      ? `~${Math.round(minutesSaved / 60)}h`
      : `~${minutesSaved}min`;

  // Channels ranked by delivery count
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

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Your stats</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="nm-raised flex flex-col gap-2 rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">This month</p>
            <Inbox className="text-muted-foreground/40 h-3.5 w-3.5" />
          </div>
          <p className="text-2xl font-bold tabular-nums">{thisMonth}</p>
          <p className="text-muted-foreground text-[11px]">
            summaries received
          </p>
        </div>

        <div className="nm-raised flex flex-col gap-2 rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">All time</p>
            <TrendingUp className="text-muted-foreground/40 h-3.5 w-3.5" />
          </div>
          <p className="text-2xl font-bold tabular-nums">{total}</p>
          <p className="text-muted-foreground text-[11px]">
            summaries received
          </p>
        </div>

        <div className="nm-raised flex flex-col gap-2 rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">Time saved</p>
            <Clock className="text-muted-foreground/40 h-3.5 w-3.5" />
          </div>
          <p className="text-2xl font-bold tabular-nums">{timeSaved}</p>
          <p className="text-muted-foreground text-[11px]">
            vs watching in full
          </p>
        </div>

        <div className="nm-raised flex flex-col gap-2 rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">Streak</p>
            <Flame
              className={`h-3.5 w-3.5 ${streak > 0 ? "text-orange-400" : "text-muted-foreground/40"}`}
            />
          </div>
          <p
            className={`text-2xl font-bold tabular-nums ${streak > 0 ? "text-orange-400" : ""}`}
          >
            {streak}
          </p>
          <p className="text-muted-foreground text-[11px]">
            {streak === 1 ? "day" : "days"} in a row
          </p>
        </div>
      </div>

      {/* Channels ranked by activity */}
      {topChannels.length > 0 && (
        <div className="nm-raised overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.04] px-4 py-2.5">
            <p className="text-xs font-medium">Most active channels</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {topChannels.map((ch, i) => (
              <div
                key={ch.name}
                className="flex items-center justify-between px-4 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="text-muted-foreground/40 w-4 shrink-0 text-[11px] tabular-nums">
                    {i + 1}
                  </span>
                  <p className="truncate text-sm">{ch.name}</p>
                </div>
                <span className="text-muted-foreground ml-2 shrink-0 text-xs tabular-nums">
                  {ch.count} {ch.count === 1 ? "summary" : "summaries"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

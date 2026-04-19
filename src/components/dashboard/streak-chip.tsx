import { createClient } from "@/lib/supabase/server";
import { StreakChipButton } from "./streak-chip-button";

type Props = {
  userId: string;
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

export async function StreakChip({ userId }: Props) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("deliveries")
    .select("listened_at")
    .eq("user_id", userId)
    .eq("status", "sent")
    .not("listened_at", "is", null);

  if (!data || data.length === 0) return null;

  const engagementDays = new Set(
    data
      .filter((d) => d.listened_at != null)
      .map((d) => toDateStr(new Date(d.listened_at ?? ""))),
  );

  const streak = computeCurrentStreak(engagementDays);
  if (streak === 0) return null;

  return <StreakChipButton streak={streak} />;
}

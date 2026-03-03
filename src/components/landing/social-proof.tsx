import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

function formatCount(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)}k+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k+`;
  if (n >= 100) return `${Math.floor(n / 10) * 10}+`;
  return `${n}+`;
}

export async function SocialProof() {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("social-proof");

  const supabase = createAdminClient();

  const [{ count: summaryCount }, { count: channelCount }] = await Promise.all([
    supabase
      .from("processed_videos")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
  ]);

  const summaries = summaryCount ?? 0;
  const channels = channelCount ?? 0;

  const stats = [
    summaries >= 20
      ? { value: formatCount(summaries), label: "summaries delivered" }
      : null,
    channels >= 10
      ? { value: formatCount(channels), label: "channels tracked" }
      : null,
  ].filter((s): s is { value: string; label: string } => s !== null);

  if (stats.length === 0) return null;

  return (
    <div className="py-8">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-10 px-6">
        {stats.map((stat, i) => (
          <div key={stat.label} className="flex items-center gap-10">
            <div className="text-center">
              <p className="text-foreground text-2xl font-bold tabular-nums">
                {stat.value}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {stat.label}
              </p>
            </div>
            {i < stats.length - 1 && (
              <div className="h-8 w-px bg-white/[0.08]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

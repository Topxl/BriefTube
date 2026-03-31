import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, getRequestIp, publicRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";

function formatCount(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)}k+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k+`;
  if (n >= 100) return `${Math.floor(n / 10) * 10}+`;
  return `${n}+`;
}

export async function GET(req: NextRequest) {
  const rateLimitResponse = await checkRateLimit(publicRateLimit, `stats:${getRequestIp(req)}`);
  if (rateLimitResponse) return rateLimitResponse;

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

  return NextResponse.json(
    { stats },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}

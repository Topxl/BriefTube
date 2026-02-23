import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getYouTubeChannelInfo } from "@/lib/youtube";
import { SiteConfig } from "@/site-config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// POST /api/onboarding/follow-list
// Subscribe the current user to all channels in one or more curated lists.
// Resolves YouTube handles to real channel IDs via page scraping.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { listIds?: string[] };
  if (!body.listIds || body.listIds.length === 0) {
    return NextResponse.json({ error: "listIds required" }, { status: 400 });
  }

  // Use admin client for DB operations to avoid session/RLS issues
  const admin = createAdminClient();

  // Fetch channels from all selected lists
  const { data: listChannels, error: listError } = await admin
    .from("list_channels")
    .select("channel_id, channel_name")
    .in("list_id", body.listIds);

  if ((listError ?? !listChannels) || listChannels.length === 0) {
    return NextResponse.json(
      { error: "Lists not found or empty" },
      { status: 404 },
    );
  }

  // Deduplicate channels across lists
  const seen = new Set<string>();
  const unique = listChannels.filter((ch) => {
    if (seen.has(ch.channel_id)) return false;
    seen.add(ch.channel_id);
    return true;
  });

  // Fetch user profile to determine plan + active channel limit
  const { data: profile } = await admin
    .from("profiles")
    .select("subscription_status, trial_ends_at, max_channels")
    .eq("id", user.id)
    .single();

  const isPro =
    profile?.subscription_status === "active" ||
    (profile?.trial_ends_at != null &&
      new Date(profile.trial_ends_at) > new Date());
  const maxActiveChannels =
    profile?.max_channels ?? SiteConfig.freeChannelsLimit;

  // Fetch user's existing subscriptions to skip duplicates and count active ones
  const { data: existingSubs } = await admin
    .from("subscriptions")
    .select("channel_id, active")
    .eq("user_id", user.id);

  const existingIds = new Set((existingSubs ?? []).map((s) => s.channel_id));
  const currentActiveCount = (existingSubs ?? []).filter(
    (s) => s.active,
  ).length;

  // Resolve all handles in parallel
  const resolved = await Promise.all(
    unique.map(async (ch) => {
      try {
        const info = await getYouTubeChannelInfo(ch.channel_id);
        return info;
      } catch {
        return {
          channelId: ch.channel_id,
          channelName: ch.channel_name,
          channelAvatarUrl: null as string | null,
        };
      }
    }),
  );

  // Filter out channels that failed to resolve to a real YouTube channel ID
  // (real IDs start with "UC" and are 24 chars — fallback returns the raw handle)
  const validResolved = resolved.filter(
    (ch) => ch.channelId.startsWith("UC") && ch.channelId.length === 24,
  );

  // Filter out already-subscribed channels
  const toInsert = validResolved.filter((ch) => !existingIds.has(ch.channelId));

  if (toInsert.length === 0) {
    return NextResponse.json({ subscribed: 0 });
  }

  // Pre-mark all existing RSS videos for new channels as "skipped" so the RSS
  // scanner never treats historical videos as new deliveries for this user.
  await Promise.allSettled(
    toInsert.map(async (ch) => {
      try {
        const rssRes = await fetch(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!rssRes.ok) return;
        const text = await rssRes.text();
        const videoIds = [
          ...text.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g),
        ].map((m) => m[1]);
        if (videoIds.length === 0) return;
        await admin.from("processed_videos").upsert(
          videoIds.map((videoId) => ({
            video_id: videoId,
            channel_id: ch.channelId,
            video_title: "[pre-subscription]",
            video_url: `https://www.youtube.com/watch?v=${videoId}`,
            status: "skipped",
            language: "fr",
          })),
          { onConflict: "video_id,language", ignoreDuplicates: true },
        );
      } catch {
        // Best-effort — don't fail the subscription if RSS is unavailable
      }
    }),
  );

  // Determine active status per channel:
  // Pro/trial users → all active; free users → active only up to maxActiveChannels
  let activeSlots = isPro
    ? Infinity
    : Math.max(0, maxActiveChannels - currentActiveCount);
  const rows = toInsert.map((ch) => {
    const active = activeSlots > 0;
    if (active) activeSlots--;
    return {
      user_id: user.id,
      channel_id: ch.channelId,
      channel_name: ch.channelName,
      channel_avatar_url: ch.channelAvatarUrl ?? null,
      active,
    };
  });

  const { error: insertError } = await admin
    .from("subscriptions")
    .upsert(rows, { onConflict: "user_id,channel_id", ignoreDuplicates: true });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ subscribed: toInsert.length });
}

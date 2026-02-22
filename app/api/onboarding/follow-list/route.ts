import { createClient } from "@/lib/supabase/server";
import { getYouTubeChannelInfo } from "@/lib/youtube";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// POST /api/onboarding/follow-list
// Subscribe the current user to all channels in one or more curated lists.
// No Pro check — called only during onboarding.
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

  // Fetch channels from all selected lists
  const { data: listChannels, error: listError } = await supabase
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

  // Fetch user's existing subscriptions to skip duplicates
  const { data: existingSubs } = await supabase
    .from("subscriptions")
    .select("channel_id")
    .eq("user_id", user.id);

  const existingIds = new Set((existingSubs ?? []).map((s) => s.channel_id));

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

  // Filter out already-subscribed channels
  const toInsert = resolved.filter((ch) => !existingIds.has(ch.channelId));

  if (toInsert.length === 0) {
    return NextResponse.json({ subscribed: 0 });
  }

  // Insert subscriptions — all active (onboarding users are Pro/trial)
  const rows = toInsert.map((ch) => ({
    user_id: user.id,
    channel_id: ch.channelId,
    channel_name: ch.channelName,
    channel_avatar_url: ch.channelAvatarUrl ?? null,
    active: true,
  }));

  const { error: insertError } = await supabase
    .from("subscriptions")
    .insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ subscribed: toInsert.length });
}

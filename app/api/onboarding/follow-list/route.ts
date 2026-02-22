import { createClient } from "@/lib/supabase/server";
import { getYouTubeChannelInfo } from "@/lib/youtube";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// POST /api/onboarding/follow-list
// Subscribe the current user to all channels in a curated list.
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

  const body = (await req.json()) as { listId?: string };
  if (!body.listId) {
    return NextResponse.json({ error: "listId required" }, { status: 400 });
  }

  // Fetch channels in this curated list
  const { data: listChannels, error: listError } = await supabase
    .from("list_channels")
    .select("channel_id, channel_name")
    .eq("list_id", body.listId);

  if ((listError ?? !listChannels) || listChannels.length === 0) {
    return NextResponse.json(
      { error: "List not found or empty" },
      { status: 404 },
    );
  }

  // Fetch user's existing subscriptions to skip duplicates
  const { data: existingSubs } = await supabase
    .from("subscriptions")
    .select("channel_id")
    .eq("user_id", user.id);

  const existingIds = new Set((existingSubs ?? []).map((s) => s.channel_id));

  // Resolve all channel handles in parallel
  const resolved = await Promise.all(
    listChannels.map(async (ch) => {
      try {
        const info = await getYouTubeChannelInfo(ch.channel_id);
        return { handle: ch.channel_id, ...info };
      } catch {
        // Fallback: use handle as-is
        return {
          handle: ch.channel_id,
          channelId: ch.channel_id,
          channelName: ch.channel_name,
          channelAvatarUrl: null,
        };
      }
    }),
  );

  // Filter out already-subscribed channels
  const toInsert = resolved.filter((ch) => !existingIds.has(ch.channelId));

  if (toInsert.length === 0) {
    return NextResponse.json({ subscribed: 0 });
  }

  // Insert subscriptions (all active — onboarding users are Pro/trial)
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

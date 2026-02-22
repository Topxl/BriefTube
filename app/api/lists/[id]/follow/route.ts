import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

// POST /api/lists/[id]/follow — auth required, toggle follow
// Pro/trial only. Following inserts ghost subscriptions (source_type='list_follow').
// Unfollowing removes them.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if already following
  const { data: existing } = await supabase
    .from("list_follows")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("list_id", id)
    .maybeSingle();

  if (existing) {
    // Unfollow: remove list_follows row + ghost subscriptions
    const { error: unfollowError } = await supabase
      .from("list_follows")
      .delete()
      .eq("user_id", user.id)
      .eq("list_id", id);

    if (unfollowError) {
      return NextResponse.json(
        { error: unfollowError.message },
        { status: 500 },
      );
    }

    await supabase
      .from("subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("list_id", id)
      .eq("source_type", "list_follow");

    return NextResponse.json({ following: false });
  }

  // Following: check user is Pro or on trial
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at")
    .eq("id", user.id)
    .single();

  const isPro =
    profile?.subscription_status === "active" ||
    (profile?.trial_ends_at != null &&
      new Date(profile.trial_ends_at) > new Date());

  if (!isPro) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        message: "Follow lists requires a Pro subscription.",
      },
      { status: 403 },
    );
  }

  // Get channels in this list
  const { data: listChannels } = await supabase
    .from("list_channels")
    .select("channel_id, channel_name, channel_avatar_url")
    .eq("list_id", id);

  if (!listChannels || listChannels.length === 0) {
    // Still allow following an empty list
    const { error: emptyFollowError } = await supabase
      .from("list_follows")
      .insert({ user_id: user.id, list_id: id });
    if (emptyFollowError) {
      return NextResponse.json(
        { error: emptyFollowError.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ following: true });
  }

  // Get existing personal subscriptions to avoid duplicates
  const { data: existingSubs } = await supabase
    .from("subscriptions")
    .select("channel_id")
    .eq("user_id", user.id)
    .in(
      "channel_id",
      listChannels.map((c) => c.channel_id),
    );

  const existingChannelIds = new Set(
    (existingSubs ?? []).map((s) => s.channel_id),
  );

  // Insert follow record first
  const { error: followError } = await supabase
    .from("list_follows")
    .insert({ user_id: user.id, list_id: id });
  if (followError) {
    return NextResponse.json({ error: followError.message }, { status: 500 });
  }

  // Insert ghost subscriptions for channels not already personally subscribed
  const ghostSubs = listChannels
    .filter((c) => !existingChannelIds.has(c.channel_id))
    .map((c) => ({
      user_id: user.id,
      channel_id: c.channel_id,
      channel_name: c.channel_name,
      channel_avatar_url: c.channel_avatar_url ?? null,
      active: true,
      source_type: "list_follow",
      list_id: id,
    }));

  if (ghostSubs.length > 0) {
    const { error } = await supabase.from("subscriptions").insert(ghostSubs);
    if (error) {
      // Rollback follow record
      await supabase
        .from("list_follows")
        .delete()
        .eq("user_id", user.id)
        .eq("list_id", id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ following: true });
}

import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/subscriptions";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkRateLimit, authRateLimit, heavyRateLimit } from "@/lib/rate-limit";

const addActionSchema = z.object({
  channelId: z.string().min(1).max(100),
  channelName: z.string().min(1).max(200),
  avatarUrl: z.string().url().nullable(),
  action: z.enum(["add_active", "add_paused", "ignore"]),
});

const removeActionSchema = z.object({
  channelId: z.string().min(1).max(100),
  action: z.enum(["deactivate", "delete", "keep"]),
});

const syncApplySchema = z.object({
  added: z.array(addActionSchema).max(500),
  removed: z.array(removeActionSchema).max(500),
});

// GET /api/youtube/sync — Fetch and clear sync diff
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await checkRateLimit(authRateLimit, `youtube-sync-get:${user.id}`);
  if (rateLimitResponse) return rateLimitResponse;

  const { data: profile } = await supabase
    .from("profiles")
    .select("youtube_sync_diff")
    .eq("id", user.id)
    .single();

  if (!profile?.youtube_sync_diff) {
    return NextResponse.json(
      { error: "No sync data available" },
      { status: 404 },
    );
  }

  const diff = profile.youtube_sync_diff;

  // Clear the diff after reading (one-time read)
  await supabase
    .from("profiles")
    .update({ youtube_sync_diff: null })
    .eq("id", user.id);

  return NextResponse.json(diff);
}

// POST /api/youtube/sync — Apply sync diff decisions
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await checkRateLimit(heavyRateLimit, `youtube-sync-post:${user.id}`);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();

  // Validate payload with Zod
  const validation = syncApplySchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: validation.error.issues },
      { status: 400 },
    );
  }

  const { added, removed } = validation.data;

  const plan = await getUserPlan(supabase, user.id);
  const isPro = plan.isPro;

  // Count current active channels
  const { count: activeCount } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);

  let currentActive = activeCount ?? 0;
  const maxActive = plan.maxChannels;

  // ── Process additions ──────────────────────────────────────────
  const toInsert = added
    .filter((a) => a.action !== "ignore")
    .map((a) => {
      const wantsActive = a.action === "add_active";
      const canActivate = isPro || currentActive < maxActive;
      const shouldBeActive = wantsActive && canActivate;
      if (shouldBeActive) currentActive++;
      return {
        user_id: user.id,
        channel_id: a.channelId,
        channel_name: a.channelName,
        channel_avatar_url: a.avatarUrl,
        active: shouldBeActive,
        paused_by_system: !shouldBeActive && wantsActive,
        source_type: "youtube_import",
      };
    });

  let insertedCount = 0;
  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("subscriptions")
      .insert(toInsert)
      .select();

    if (insertError) {
      logger.error("Sync insert failed:", insertError);
      return NextResponse.json(
        { error: "Failed to add channels" },
        { status: 500 },
      );
    }
    insertedCount = inserted.length;
  }

  // ── Process removals ───────────────────────────────────────────
  let deactivatedCount = 0;
  let deletedCount = 0;

  const toDeactivate = removed
    .filter((r) => r.action === "deactivate")
    .map((r) => r.channelId);

  const toDelete = removed
    .filter((r) => r.action === "delete")
    .map((r) => r.channelId);

  if (toDeactivate.length > 0) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ active: false, paused_by_system: false })
      .eq("user_id", user.id)
      .in("channel_id", toDeactivate);

    if (error) {
      logger.error("Sync deactivate failed:", error);
    } else {
      deactivatedCount = toDeactivate.length;
    }
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("user_id", user.id)
      .in("channel_id", toDelete);

    if (error) {
      logger.error("Sync delete failed:", error);
    } else {
      deletedCount = toDelete.length;
    }
  }

  logger.info(
    `Sync applied: ${insertedCount} added, ${deactivatedCount} deactivated, ${deletedCount} deleted`,
  );

  return NextResponse.json({
    inserted: insertedCount,
    deactivated: deactivatedCount,
    deleted: deletedCount,
  });
}

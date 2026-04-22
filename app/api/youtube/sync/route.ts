import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/subscriptions";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  checkRateLimit,
  authRateLimit,
  heavyRateLimit,
} from "@/lib/rate-limit";
import { captureServerEvent } from "@/lib/posthog/server";

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

  const rateLimitResponse = await checkRateLimit(
    authRateLimit,
    `youtube-sync-get:${user.id}`,
  );
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

  const rateLimitResponse = await checkRateLimit(
    heavyRateLimit,
    `youtube-sync-post:${user.id}`,
  );
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
        // No source_type set: stays NULL like channels added via the OAuth
        // import flow, so dashboard queries filtering on
        // `source_type IS NULL OR source_type = 'youtube_channel'` see them.
      };
    });

  let insertedCount = 0;
  let promotedCount = 0;
  if (toInsert.length > 0) {
    // A "new" channel from the diff may already exist in our DB as a
    // `list_follow` row (inherited from a shared list the user follows). The
    // sync diff filters those out, so they show up as "added" — but inserting
    // would violate the (user_id, channel_id) unique constraint.
    //
    // Resolution:
    //   - row missing      → INSERT
    //   - row source=NULL/youtube_channel → SKIP (already a direct sub)
    //   - row source=list_follow         → PROMOTE to direct sub (clear
    //     source_type + list_id, apply the user's active/paused choice)
    const channelIds = toInsert.map((r) => r.channel_id);
    const { data: existingRows } = await supabase
      .from("subscriptions")
      .select("id, channel_id, source_type")
      .eq("user_id", user.id)
      .in("channel_id", channelIds);
    const byChannel = new Map(
      (existingRows ?? []).map((r) => [r.channel_id, r]),
    );

    const safeToInsert: typeof toInsert = [];
    const toPromote: {
      id: string;
      active: boolean;
      avatarUrl: string | null;
    }[] = [];
    for (const row of toInsert) {
      const existing = byChannel.get(row.channel_id);
      if (!existing) {
        safeToInsert.push(row);
      } else if (existing.source_type === "list_follow") {
        toPromote.push({
          id: existing.id,
          active: row.active,
          avatarUrl: row.channel_avatar_url,
        });
      }
      // else: already a direct sub, skip silently.
    }

    if (safeToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("subscriptions")
        .insert(safeToInsert)
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

    // Promote list_follow rows to direct subscriptions one-by-one (we need
    // per-row `active` value since the unique-by-id update keeps it simple).
    // Also refresh the avatar URL with the fresh one from the YouTube API,
    // since list_follow rows often have stale or missing avatars.
    for (const p of toPromote) {
      const updates: {
        source_type: null;
        list_id: null;
        active: boolean;
        paused_by_system: false;
        channel_avatar_url?: string;
      } = {
        source_type: null,
        list_id: null,
        active: p.active,
        paused_by_system: false,
      };
      if (p.avatarUrl) updates.channel_avatar_url = p.avatarUrl;
      // eslint-disable-next-line no-await-in-loop
      const { error: updErr } = await supabase
        .from("subscriptions")
        .update(updates)
        .eq("id", p.id);
      if (updErr) {
        logger.error("Sync promote failed:", updErr);
      } else {
        promotedCount++;
      }
    }
  }
  // Promoted rows count as "inserted" from the user's POV — they'll see them
  // as new direct subscriptions in the dashboard.
  insertedCount += promotedCount;

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

  // Track YouTube sync
  await captureServerEvent({
    distinctId: user.id,
    event: "youtube_sync_applied",
    properties: {
      inserted: insertedCount,
      deactivated: deactivatedCount,
      deleted: deletedCount,
    },
  });

  return NextResponse.json({
    inserted: insertedCount,
    deactivated: deactivatedCount,
    deleted: deletedCount,
  });
}

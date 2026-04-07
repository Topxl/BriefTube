import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { getYouTubeChannelInfo, fetchVideoOembed } from "@/lib/youtube";
import { extractVideoId } from "@/lib/youtube-id";
import { getUserPlan } from "@/lib/subscriptions";
import { queueVideoForProcessing } from "@/lib/video-queue";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  checkRateLimit,
  authRateLimit,
  heavyRateLimit,
} from "@/lib/rate-limit";
import { captureServerEvent } from "@/lib/posthog/server";

// GET /api/subscriptions - Get user's YouTube channel subscriptions
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

type ChannelInfo = {
  channelId: string;
  channelName: string;
  /** Set when the input URL is a video link — this specific video will be used as the aha-moment delivery */
  videoId?: string;
  videoTitle?: string;
};

// Helper to extract channel info from URL (supports video links via YouTube oEmbed)
async function extractChannelInfo(url: string): Promise<ChannelInfo> {
  // Video URL: youtube.com/watch?v=ID  or  youtu.be/ID
  const videoId = extractVideoId(url);
  if (videoId) {
    const oembedData = await fetchVideoOembed(videoId);
    if (oembedData) {
      // author_url is like "https://www.youtube.com/@ChannelHandle"
      const handleMatch = oembedData.author_url.match(/\/@([a-zA-Z0-9_-]+)/);
      const channelId = handleMatch
        ? `@${handleMatch[1]}`
        : oembedData.author_name;
      return {
        channelId,
        channelName: oembedData.author_name,
        videoId,
        videoTitle: oembedData.title,
      };
    }
    throw new Error("Could not fetch video info — try again");
  }

  // @handle
  const handleMatch = url.match(/@([a-zA-Z0-9_-]+)/);
  if (handleMatch) {
    return { channelId: `@${handleMatch[1]}`, channelName: handleMatch[1] };
  }

  // /channel/UCxxxxxx
  const channelMatch = url.match(/channel\/([a-zA-Z0-9_-]+)/);
  if (channelMatch) {
    return { channelId: channelMatch[1], channelName: channelMatch[1] };
  }

  // /c/name
  const cMatch = url.match(/\/c\/([a-zA-Z0-9_-]+)/);
  if (cMatch) {
    return { channelId: cMatch[1], channelName: cMatch[1] };
  }

  // Bare handle or ID
  const bare = url.replace(/[@/]/g, "");
  return { channelId: bare, channelName: bare };
}

// POST /api/subscriptions - Add new YouTube channel subscription
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(heavyRateLimit, user.id);
  if (rl) return rl;

  const bodySchema = z.object({
    url: z.string().max(2000).optional(),
    channelId: z.string().max(100).optional(),
    channelName: z.string().max(500).optional(),
    videoId: z.string().max(50).optional(),
    videoTitle: z.string().max(1000).optional(),
  });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    logger.error("Subscription validation failed:", {
      errors: parsed.error.issues,
      body: rawBody,
    });
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const body = parsed.data as {
    url?: string;
    channelId?: string;
    channelName?: string;
    videoId?: string;
    videoTitle?: string;
  };

  // Support both { url } and { channelId, channelName } formats
  let channelId: string | undefined;
  let channelName: string | undefined;
  let specificVideoId: string | undefined;
  let specificVideoTitle: string | undefined;

  if (body.url) {
    try {
      const extracted = await extractChannelInfo(body.url);
      channelId = extracted.channelId;
      channelName = extracted.channelName;
      specificVideoId = extracted.videoId;
      specificVideoTitle = extracted.videoTitle;
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not fetch video info — try again",
        },
        { status: 422 },
      );
    }
  } else {
    // Direct channelId/channelName (+ optional videoId/videoTitle)
    channelId = body.channelId ?? "";
    channelName = body.channelName ?? "";
    specificVideoId = body.videoId ?? undefined;
    specificVideoTitle = body.videoTitle ?? undefined;
  }

  if (!channelId || !channelName) {
    logger.error("Missing required fields:", {
      channelId,
      channelName,
      url: body.url,
    });
    return NextResponse.json(
      {
        error: "channelId and channelName are required",
        received: { channelId, channelName, url: body.url },
      },
      { status: 400 },
    );
  }

  logger.info("Adding subscription:", {
    channelId,
    channelName,
    userId: user.id,
  });

  // Fetch real channel info from YouTube (including avatar)
  const youtubeInfo = await getYouTubeChannelInfo(channelId);

  // Use YouTube scraped data
  const finalChannelId = youtubeInfo.channelId;
  const finalChannelName = youtubeInfo.channelName;
  const finalAvatarUrl = youtubeInfo.channelAvatarUrl;

  // Validate that we resolved a real YouTube channel ID (UCxxxxxxxxxxxxxxxxxxxxxxxx).
  // If getYouTubeChannelInfo couldn't find one, it falls back to the raw input —
  // which may be a name, a malformed URL, etc. — and must be rejected.
  const YOUTUBE_CHANNEL_ID_RE = /^UC[a-zA-Z0-9_-]{22}$/;
  if (!YOUTUBE_CHANNEL_ID_RE.test(finalChannelId)) {
    logger.warn("Invalid channel ID after YouTube lookup — rejecting:", {
      input: channelId,
      resolved: finalChannelId,
    });
    return NextResponse.json(
      {
        error:
          "Could not find a valid YouTube channel. Please use a channel URL (e.g. youtube.com/@handle) or a video URL.",
      },
      { status: 422 },
    );
  }

  logger.info("YouTube channel info fetched:", {
    channelId: finalChannelId,
    channelName: finalChannelName,
    hasAvatar: !!finalAvatarUrl,
  });

  // Check user's profile for max active channels limit
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .single();

  const plan = await getUserPlan(supabase, user.id);

  // Count currently active subscriptions
  const { count: activeCount } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);

  const maxActiveChannels = plan.maxChannels;
  const isPro = plan.isPro;

  // Free users can always add channels, but active is limited to maxActiveChannels
  const shouldBeActive = isPro || (activeCount ?? 0) < maxActiveChannels;

  // Check if already subscribed (using original channelId before YouTube fetch)
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("channel_id", finalChannelId)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Already subscribed to this channel" },
      { status: 409 },
    );
  }

  // Before inserting the subscription, mark all existing channel videos in
  // processed_videos so the RSS scanner never sees them as "new".
  // This prevents a race condition where the scanner runs between the subscription
  // insert and the video initialisation, creating spurious deliveries for old videos.
  let latestVideo: { videoId: string; title: string | null } | null = null;

  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${finalChannelId}`;
    const rssResponse = await fetch(rssUrl);
    const rssText = await rssResponse.text();

    // Extract entries in order (first = most recent)
    const entries = [...rssText.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(
      (m) => m[1],
    );

    const videos = entries
      .map((entry) => ({
        videoId: entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? null,
        title: entry.match(/<title>([^<]+)<\/title>/)?.[1] ?? null,
      }))
      .filter(
        (v): v is { videoId: string; title: string | null } => !!v.videoId,
      );

    if (videos.length === 0) {
      logger.info(`No videos found in RSS for channel ${finalChannelId}`);
    } else {
      // Mark ALL videos as skipped first — this blocks the scanner from picking
      // them up while we insert the subscription below.
      // Use admin client to bypass RLS (processed_videos has no user-session INSERT policy).
      const admin = createAdminClient();
      const skipResults = await Promise.all(
        videos.map((v) =>
          admin.from("processed_videos").upsert(
            {
              video_id: v.videoId,
              channel_id: finalChannelId,
              video_title: "[pre-subscription]",
              video_url: `https://www.youtube.com/watch?v=${v.videoId}`,
              status: "skipped",
              language: profile?.preferred_language ?? "fr",
            },
            { onConflict: "video_id,language", ignoreDuplicates: true },
          ),
        ),
      );
      const skipErrors = skipResults.filter((r) => r.error);
      if (skipErrors.length > 0) {
        logger.error(
          `Failed to pre-mark ${skipErrors.length} videos as skipped:`,
          skipErrors[0].error,
        );
      }

      // Remember the latest video so we can queue it after the subscription is saved.
      latestVideo = videos[0];
      logger.info(
        `Pre-marked ${videos.length} videos as skipped for channel ${finalChannelId}`,
      );
    }
  } catch (e) {
    logger.error("Failed to pre-mark channel videos:", e);
  }

  // Add subscription with real YouTube data
  // active = false if free user already has maxActiveChannels active
  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: user.id,
      channel_id: finalChannelId,
      channel_name: finalChannelName,
      channel_avatar_url: finalAvatarUrl,
      active: shouldBeActive,
      paused_by_system: !shouldBeActive,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  captureServerEvent({
    distinctId: user.id,
    event: "channel_added",
    properties: {
      channel_id: finalChannelId,
      channel_name: finalChannelName,
    },
  });

  // Track "time to first value" — first channel is the key activation moment
  if ((activeCount ?? 0) === 0) {
    captureServerEvent({
      distinctId: user.id,
      event: "first_channel_added",
      properties: {
        channel_id: finalChannelId,
        channel_name: finalChannelName,
        time_since_signup_seconds: Math.floor(
          (Date.now() - new Date(user.created_at).getTime()) / 1000,
        ),
      },
    });
  }

  // Aha moment: deliver a video immediately after subscribing.
  // - If user added via a video URL → deliver that specific video.
  // - Otherwise → deliver the most recent video from the channel's RSS feed.
  const ahaVideo = specificVideoId
    ? { videoId: specificVideoId, title: specificVideoTitle ?? specificVideoId }
    : latestVideo
      ? {
          videoId: latestVideo.videoId,
          title: latestVideo.title ?? latestVideo.videoId,
        }
      : null;

  if (ahaVideo) {
    try {
      const userLang = profile?.preferred_language ?? "fr";
      const { queued } = await queueVideoForProcessing(createAdminClient(), {
        userId: user.id,
        videoId: ahaVideo.videoId,
        videoTitle: ahaVideo.title,
        channelId: finalChannelId,
        userLang,
        // Aha moment: first video from a newly added channel — user is waiting
        priority: 100,
      });

      if (queued) {
        logger.info(
          `Aha video queued for immediate delivery: ${ahaVideo.title} (${ahaVideo.videoId})`,
        );
      } else {
        logger.info(
          `Aha video already processing/completed, delivery created directly: ${ahaVideo.videoId}`,
        );
      }
    } catch (e) {
      logger.error("Failed to deliver aha video:", e);
    }
  }

  return NextResponse.json(
    {
      ...data,
      videoId: ahaVideo?.videoId ?? null,
      videoTitle: ahaVideo?.title ?? null,
    },
    { status: 201 },
  );
}

// PATCH /api/subscriptions - Toggle active status for a subscription
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(authRateLimit, user.id);
  if (rl) return rl;

  const patchSchema = z.object({
    id: z.string().uuid(),
    active: z.boolean().optional(),
    summary_length_pref: z
      .enum(["brief", "standard", "detailed"])
      .nullable()
      .optional(),
    summary_style: z
      .enum(["key_points", "narrative", "actionable"])
      .nullable()
      .optional(),
    summary_custom_instructions: z.string().max(500).nullable().optional(),
  });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const {
    id,
    active,
    summary_length_pref,
    summary_style,
    summary_custom_instructions,
  } = parsed.data;

  // Build the update payload — only include fields that were explicitly sent
  const updatePayload: {
    active?: boolean;
    paused_by_system?: boolean;
    summary_length_pref?: string | null;
    summary_style?: string | null;
    summary_custom_instructions?: string | null;
  } = {};

  if (active !== undefined) {
    // If activating, check the active channel limit
    if (active) {
      const plan = await getUserPlan(supabase, user.id);
      const isPro = plan.isPro;
      const maxActiveChannels = plan.maxChannels;

      if (!isPro) {
        const { count } = await supabase
          .from("subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("active", true);

        if ((count ?? 0) >= maxActiveChannels) {
          return NextResponse.json(
            { error: "Active channel limit reached", maxActiveChannels },
            { status: 403 },
          );
        }
      }
    }
    updatePayload.active = active;
    updatePayload.paused_by_system = false;
  }

  if (summary_length_pref !== undefined)
    updatePayload.summary_length_pref = summary_length_pref;
  if (summary_style !== undefined) updatePayload.summary_style = summary_style;
  if (summary_custom_instructions !== undefined)
    updatePayload.summary_custom_instructions = summary_custom_instructions;

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT /api/subscriptions - Bulk activate or pause all subscriptions
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(authRateLimit, user.id);
  if (rl) return rl;

  const body = (await request.json()) as { action: string };
  const { action } = body;

  if (action !== "activate_all" && action !== "pause_all") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (action === "pause_all") {
    const { error } = await supabase
      .from("subscriptions")
      .update({ active: false, paused_by_system: false })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: true });
  }

  // activate_all — respect the active channel limit for free users
  const plan = await getUserPlan(supabase, user.id);
  const isPro = plan.isPro;

  if (isPro) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ active: true })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: true });
  }

  // Free user: only activate up to (maxActiveChannels - currentActiveCount) paused channels
  const maxActiveChannels = plan.maxChannels;

  const { count: activeCount } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);

  const slotsLeft = maxActiveChannels - (activeCount ?? 0);

  if (slotsLeft <= 0) {
    return NextResponse.json({
      updated: false,
      limitReached: true,
      maxActiveChannels,
    });
  }

  // Get paused subscriptions ordered by created_at, take only what fits
  const { data: paused } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", false)
    .order("created_at", { ascending: true })
    .limit(slotsLeft);

  if (!paused || paused.length === 0) {
    return NextResponse.json({ updated: false });
  }

  const idsToActivate = paused.map((s) => s.id);
  const { error } = await supabase
    .from("subscriptions")
    .update({ active: true })
    .in("id", idsToActivate)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    updated: true,
    activatedCount: idsToActivate.length,
  });
}

// DELETE /api/subscriptions - Remove YouTube channel subscription
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(authRateLimit, user.id);
  if (rl) return rl;

  const { searchParams } = new URL(request.url);
  const subscriptionId = searchParams.get("id");

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "Subscription ID required" },
      { status: 400 },
    );
  }

  // Fetch channel info before deleting (for tracking)
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("channel_id, channel_name")
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", subscriptionId)
    .eq("user_id", user.id); // Security: only delete own subscriptions

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  captureServerEvent({
    distinctId: user.id,
    event: "channel_removed",
    properties: {
      channel_id: sub?.channel_id,
      channel_name: sub?.channel_name,
    },
  });

  return NextResponse.json({ success: true });
}

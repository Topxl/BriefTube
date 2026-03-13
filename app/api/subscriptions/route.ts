import { SiteConfig } from "@/site-config";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { getYouTubeChannelInfo } from "@/lib/youtube";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  const videoMatch = url.match(
    /(?:watch\?(?:[^&]*&)*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (videoMatch) {
    const videoId = videoMatch[1];
    try {
      // oEmbed is the official, free, no-key-required YouTube metadata API
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data = (await res.json()) as {
          title: string;
          author_name: string;
          author_url: string;
        };
        // author_url is like "https://www.youtube.com/@ChannelHandle"
        const handleMatch = data.author_url.match(/\/@([a-zA-Z0-9_-]+)/);
        const channelId = handleMatch ? `@${handleMatch[1]}` : data.author_name;
        return {
          channelId,
          channelName: data.author_name,
          videoId,
          videoTitle: data.title,
        };
      }
    } catch {
      // fall through to generic fallback
    }
    return { channelId: videoId, channelName: videoId, videoId };
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

  const body = await request.json();

  // Support both { url } and { channelId, channelName } formats
  let channelId: string;
  let channelName: string;
  let specificVideoId: string | undefined;
  let specificVideoTitle: string | undefined;

  if (body.url) {
    // Extract from URL (async — handles video links via oEmbed)
    const extracted = await extractChannelInfo(body.url);
    channelId = extracted.channelId;
    channelName = extracted.channelName;
    specificVideoId = extracted.videoId;
    specificVideoTitle = extracted.videoTitle;
  } else {
    // Direct channelId/channelName
    channelId = body.channelId;
    channelName = body.channelName;
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

  logger.info("YouTube channel info fetched:", {
    channelId: finalChannelId,
    channelName: finalChannelName,
    hasAvatar: !!finalAvatarUrl,
  });

  // Check user's profile for max active channels limit
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "max_channels, subscription_status, trial_ends_at, preferred_language",
    )
    .eq("id", user.id)
    .single();

  // Count currently active subscriptions
  const { count: activeCount } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);

  const maxActiveChannels =
    profile?.max_channels ?? SiteConfig.freeChannelsLimit;
  const isPro =
    profile?.subscription_status === "active" ||
    (profile?.trial_ends_at != null &&
      new Date(profile.trial_ends_at) > new Date());

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
      const skipResults = await Promise.all(
        videos.map((v) =>
          supabase.from("processed_videos").upsert(
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
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
      const ahaUrl = `https://www.youtube.com/watch?v=${ahaVideo.videoId}`;
      const userLang = profile?.preferred_language ?? "fr";

      // Check current status — never downgrade a completed/in-progress video back to "pending"
      const { data: existingAha } = await supabase
        .from("processed_videos")
        .select("status")
        .eq("video_id", ahaVideo.videoId)
        .maybeSingle();

      const existingStatus = existingAha?.status;

      if (
        existingStatus === "completed" ||
        existingStatus === "pending" ||
        existingStatus === "processing"
      ) {
        // Already processed or in progress — just create the delivery, no reprocessing
        await supabase.from("deliveries").insert({
          user_id: user.id,
          video_id: ahaVideo.videoId,
          status: "pending",
          language: userLang,
        });
        logger.info(
          `Aha video already ${existingStatus}, delivery created directly: ${ahaVideo.videoId}`,
        );
      } else {
        // "skipped" or absent — upgrade to pending and queue
        await supabase.from("processed_videos").upsert(
          {
            video_id: ahaVideo.videoId,
            channel_id: finalChannelId,
            video_title: ahaVideo.title,
            video_url: ahaUrl,
            status: "pending",
            language: userLang,
          },
          { onConflict: "video_id,language" },
        );

        // Insert into processing_queue only if no existing job for this video
        const { data: existingJob } = await supabase
          .from("processing_queue")
          .select("id")
          .eq("video_id", ahaVideo.videoId)
          .maybeSingle();

        if (!existingJob) {
          await supabase.from("processing_queue").insert({
            video_id: ahaVideo.videoId,
            youtube_url: ahaUrl,
            video_title: ahaVideo.title,
            channel_id: finalChannelId,
            status: "queued",
            user_language: userLang,
          });
        }

        await supabase.from("deliveries").insert({
          user_id: user.id,
          video_id: ahaVideo.videoId,
          status: "pending",
          language: userLang,
        });

        logger.info(
          `Aha video queued for immediate delivery: ${ahaVideo.title} (${ahaVideo.videoId})`,
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

  const body = (await request.json()) as { id: string; active: boolean };
  const { id, active } = body;

  if (!id || typeof active !== "boolean") {
    return NextResponse.json(
      { error: "id and active are required" },
      { status: 400 },
    );
  }

  // If activating, check the active channel limit
  if (active) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("max_channels, subscription_status, trial_ends_at")
      .eq("id", user.id)
      .single();

    const isPro =
      profile?.subscription_status === "active" ||
      (profile?.trial_ends_at != null &&
        new Date(profile.trial_ends_at) > new Date());
    const maxActiveChannels =
      profile?.max_channels ?? SiteConfig.freeChannelsLimit;

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

  const { data, error } = await supabase
    .from("subscriptions")
    .update({ active })
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

  const body = (await request.json()) as { action: string };
  const { action } = body;

  if (action !== "activate_all" && action !== "pause_all") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (action === "pause_all") {
    const { error } = await supabase
      .from("subscriptions")
      .update({ active: false })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: true });
  }

  // activate_all — respect the active channel limit for free users
  const { data: profile } = await supabase
    .from("profiles")
    .select("max_channels, subscription_status, trial_ends_at")
    .eq("id", user.id)
    .single();

  const isPro =
    profile?.subscription_status === "active" ||
    (profile?.trial_ends_at != null &&
      new Date(profile.trial_ends_at) > new Date());

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
  const maxActiveChannels =
    profile?.max_channels ?? SiteConfig.freeChannelsLimit;

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

  const { searchParams } = new URL(request.url);
  const subscriptionId = searchParams.get("id");

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "Subscription ID required" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", subscriptionId)
    .eq("user_id", user.id); // Security: only delete own subscriptions

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

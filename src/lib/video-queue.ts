import type { SupabaseClient } from "@supabase/supabase-js";
import { toVideoUrl } from "@/lib/youtube-id";
import { fetchVideoMetadata } from "@/lib/youtube";

type QueueVideoParams = {
  userId: string;
  videoId: string;
  videoTitle: string;
  channelId: string;
  userLang: string;
  /**
   * Job priority. Higher = processed first.
   * - 100: User-initiated on-demand request (search bar, Summarize button) — urgent
   * - 10: New channel subscription first video — "aha moment"
   * - 0 (default): Background RSS/WebSub auto-queued videos
   */
  priority?: number;
};

/**
 * Ensures a video is queued for processing and a delivery record exists.
 * - If already completed/pending/processing: just insert delivery, skip reprocessing.
 * - If failed/missing: (re)insert into processed_videos and processing_queue.
 * Returns whether a new processing job was created.
 */
export async function queueVideoForProcessing(
  supabase: SupabaseClient,
  params: QueueVideoParams,
): Promise<{ queued: boolean }> {
  const {
    userId,
    videoId,
    videoTitle,
    channelId,
    userLang,
    priority = 0,
  } = params;
  const videoUrl = toVideoUrl(videoId);

  // Fetch user's summary preferences (profile defaults)
  const { data: prefs } = await supabase
    .from("profiles")
    .select("summary_length_pref, summary_style, summary_custom_instructions")
    .eq("id", userId)
    .single();

  // Fetch channel-specific overrides from the subscription (if any)
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("summary_length_pref, summary_style, summary_custom_instructions")
    .eq("user_id", userId)
    .eq("channel_id", channelId)
    .maybeSingle();

  // Channel overrides take priority over profile defaults
  const summaryLengthPref =
    subscription?.summary_length_pref ?? prefs?.summary_length_pref ?? "auto";
  const summaryStyle =
    subscription?.summary_style ?? prefs?.summary_style ?? "narrative";
  const summaryCustomInstructions =
    subscription?.summary_custom_instructions ??
    prefs?.summary_custom_instructions ??
    "";

  // Check current processing status — filter by language to avoid mixing rows
  // (a video can have separate fr/en rows; maybeSingle() would error on multiple)
  const { data: existing } = await supabase
    .from("processed_videos")
    .select("status, video_title, channel_id")
    .eq("video_id", videoId)
    .eq("language", userLang)
    .maybeSingle();

  // Also look up any other-language row for this video — useful to inherit
  // a real title and channel_id when we're creating a new-language entry
  const { data: otherLang } = await supabase
    .from("processed_videos")
    .select("video_title, channel_id")
    .eq("video_id", videoId)
    .neq("language", userLang)
    .neq("video_title", videoId)
    .limit(1)
    .maybeSingle();

  if (
    existing?.status === "completed" ||
    existing?.status === "pending" ||
    existing?.status === "processing"
  ) {
    // Check if a delivery already exists for this user+video
    const { data: existingDelivery } = await supabase
      .from("deliveries")
      .select("id")
      .eq("user_id", userId)
      .eq("video_id", videoId)
      .maybeSingle();

    if (existingDelivery) {
      // Bump created_at to bring the video to the top of the feed
      await supabase
        .from("deliveries")
        .update({ created_at: new Date().toISOString() })
        .eq("id", existingDelivery.id);
    } else {
      // No delivery yet — create one
      await supabase.from("deliveries").insert({
        user_id: userId,
        video_id: videoId,
        status: "pending",
        language: userLang,
      });
    }
    return { queued: false };
  }

  // Prefer a real title over the video_id fallback.
  // Priority: caller-provided > existing-same-lang > other-lang > oEmbed fetch > videoId
  let title: string =
    (videoTitle && videoTitle !== videoId ? videoTitle : null) ||
    (existing?.video_title &&
    existing.video_title !== videoId &&
    existing.video_title !== "[pre-subscription]"
      ? existing.video_title
      : null) ||
    otherLang?.video_title ||
    "";

  // Resolve channel_id from existing row, other-language row, or caller
  let resolvedChannelId: string =
    (existing?.channel_id && existing.channel_id !== ""
      ? existing.channel_id
      : null) ||
    (otherLang?.channel_id && otherLang.channel_id !== ""
      ? otherLang.channel_id
      : null) ||
    channelId ||
    "";

  // If title OR channel_id is missing, fetch both from YouTube (oEmbed + channel page scrape)
  if (!title || title === videoId || !resolvedChannelId) {
    const metadata = await fetchVideoMetadata(videoId);
    if (!title || title === videoId) {
      title = metadata.title ?? videoId;
    }
    if (!resolvedChannelId) {
      resolvedChannelId = metadata.channelId ?? "";
    }
  }

  if (existing) {
    await supabase
      .from("processed_videos")
      .update({
        status: "pending",
        video_title: title,
        ...(resolvedChannelId !== existing.channel_id
          ? { channel_id: resolvedChannelId }
          : {}),
      })
      .eq("video_id", videoId)
      .eq("language", userLang);
  } else {
    await supabase.from("processed_videos").insert({
      video_id: videoId,
      video_title: title,
      video_url: videoUrl,
      status: "pending",
      language: userLang,
      channel_id: resolvedChannelId,
    });
  }

  // Deduplication: only insert a new job if none is queued/processing
  const { data: existingJob } = await supabase
    .from("processing_queue")
    .select("id")
    .eq("video_id", videoId)
    .in("status", ["queued", "processing"])
    .maybeSingle();

  if (!existingJob) {
    await supabase.from("processing_queue").insert({
      video_id: videoId,
      youtube_url: videoUrl,
      video_title: title,
      channel_id: resolvedChannelId,
      status: "queued",
      user_language: userLang,
      priority,
      summary_length_pref: summaryLengthPref,
      summary_style: summaryStyle,
      summary_custom_instructions: summaryCustomInstructions,
    });
  } else if (priority > 0) {
    // Existing job: bump its priority if the new request is higher priority
    await supabase
      .from("processing_queue")
      .update({ priority })
      .eq("id", existingJob.id)
      .lt("priority", priority);
  }

  await supabase.from("deliveries").insert({
    user_id: userId,
    video_id: videoId,
    status: "pending",
    language: userLang,
  });

  return { queued: true };
}

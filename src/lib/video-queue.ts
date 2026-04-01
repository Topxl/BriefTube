import type { SupabaseClient } from "@supabase/supabase-js";
import { toVideoUrl } from "@/lib/youtube-id";

type QueueVideoParams = {
  userId: string;
  videoId: string;
  videoTitle: string;
  channelId: string;
  userLang: string;
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
  const { userId, videoId, videoTitle, channelId, userLang } = params;
  const videoUrl = toVideoUrl(videoId);

  // Fetch user's summary preferences
  const { data: prefs } = await supabase
    .from("profiles")
    .select("summary_length_pref, summary_style, summary_custom_instructions")
    .eq("id", userId)
    .single();
  const summaryLengthPref = prefs?.summary_length_pref ?? "standard";
  const summaryStyle = prefs?.summary_style ?? "narrative";
  const summaryCustomInstructions = prefs?.summary_custom_instructions ?? "";

  // Check current processing status — filter by language to avoid mixing rows
  // (a video can have separate fr/en rows; maybeSingle() would error on multiple)
  const { data: existing } = await supabase
    .from("processed_videos")
    .select("status, video_title, channel_id")
    .eq("video_id", videoId)
    .eq("language", userLang)
    .maybeSingle();

  if (
    existing?.status === "completed" ||
    existing?.status === "pending" ||
    existing?.status === "processing"
  ) {
    await supabase.from("deliveries").insert({
      user_id: userId,
      video_id: videoId,
      status: "pending",
      language: userLang,
    });
    return { queued: false };
  }

  // Prefer a real title over the video_id fallback.
  // If the caller only had the video_id, the worker will backfill the real title
  // from YouTube metadata once it fetches it.
  const title =
    (videoTitle !== videoId ? videoTitle : null) ||
    (existing?.video_title !== "[pre-subscription]"
      ? existing?.video_title
      : null) ||
    videoId;
  if (existing) {
    await supabase
      .from("processed_videos")
      .update({ status: "pending", video_title: title })
      .eq("video_id", videoId)
      .eq("language", userLang);
  } else {
    await supabase.from("processed_videos").insert({
      video_id: videoId,
      video_title: title,
      video_url: videoUrl,
      status: "pending",
      language: userLang,
      channel_id: channelId,
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
      channel_id: existing?.channel_id ?? channelId,
      status: "queued",
      user_language: userLang,
      summary_length_pref: summaryLengthPref,
      summary_style: summaryStyle,
      summary_custom_instructions: summaryCustomInstructions,
    });
  }

  await supabase.from("deliveries").insert({
    user_id: userId,
    video_id: videoId,
    status: "pending",
    language: userLang,
  });

  return { queued: true };
}

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchVideoMetadata } from "@/lib/youtube";
import { logger } from "@/lib/logger";

/**
 * Admin route to backfill channel_id for videos that have it empty or NULL.
 * Fetches the real UC channel ID from YouTube (via oEmbed + page scrape).
 *
 * Usage: POST /api/admin/backfill-channels
 */
export async function POST() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  // Fetch all videos with empty/null channel_id
  const { data: brokenVideos, error } = await admin
    .from("processed_videos")
    .select("video_id, video_title")
    .or("channel_id.is.null,channel_id.eq.")
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (brokenVideos.length === 0) {
    return NextResponse.json({ ok: true, fixed: 0, total: 0 });
  }

  // Dedupe by video_id (same video might exist in multiple languages)
  const uniqueIds = [...new Set(brokenVideos.map((v) => v.video_id))];

  const results: { videoId: string; status: string; channelId?: string }[] = [];
  let fixed = 0;

  // Process in batches of 5 to avoid hammering YouTube
  const processBatch = async (batch: string[]) =>
    Promise.all(
      batch.map(async (videoId) => {
        try {
          const metadata = await fetchVideoMetadata(videoId);
          if (!metadata.channelId) {
            return { videoId, status: "no_channel_found" };
          }
          const { error: updateError } = await admin
            .from("processed_videos")
            .update({
              channel_id: metadata.channelId,
              ...(metadata.title ? { video_title: metadata.title } : {}),
            })
            .eq("video_id", videoId)
            .or("channel_id.is.null,channel_id.eq.");
          if (updateError) {
            return { videoId, status: `update_error: ${updateError.message}` };
          }
          return { videoId, status: "fixed", channelId: metadata.channelId };
        } catch (err) {
          return {
            videoId,
            status: `error: ${err instanceof Error ? err.message : "unknown"}`,
          };
        }
      }),
    );

  const batches: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 5) {
    batches.push(uniqueIds.slice(i, i + 5));
  }
  // Sequential batches to rate-limit YouTube requests

  for (const batch of batches) {
    // eslint-disable-next-line no-await-in-loop
    const batchResults = await processBatch(batch);
    results.push(...batchResults);
    fixed += batchResults.filter((r) => r.status === "fixed").length;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  logger.info(`Backfill: fixed ${fixed}/${uniqueIds.length} videos`);

  return NextResponse.json({
    ok: true,
    total: uniqueIds.length,
    fixed,
    results,
  });
}

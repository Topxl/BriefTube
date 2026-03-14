import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const POST = authRoute
  .body(z.object({ videoId: z.string(), videoTitle: z.string().optional() }))
  .handler(async (_req, { body, ctx }) => {
    const supabase = await createClient();
    const { videoId, videoTitle } = body as {
      videoId: string;
      videoTitle?: string;
    };
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Get user language
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_language, tts_voice")
      .eq("id", ctx.user.id)
      .single();
    const userLang = profile?.preferred_language ?? "fr";

    // Check current status
    const { data: existing } = await supabase
      .from("processed_videos")
      .select("status, video_title, channel_id")
      .eq("video_id", videoId)
      .maybeSingle();

    if (
      existing?.status === "completed" ||
      existing?.status === "pending" ||
      existing?.status === "processing"
    ) {
      // Already done or in progress — just add delivery
      await supabase.from("deliveries").insert({
        user_id: ctx.user.id,
        video_id: videoId,
        status: "pending",
        language: userLang,
      });
      return { ok: true, queued: false };
    }

    // Queue for processing
    const title = videoTitle ?? existing?.video_title ?? videoId;
    if (existing) {
      // Row exists (failed/skipped) — reset to pending
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
        channel_id: "",
      });
    }

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
        channel_id: existing?.channel_id ?? "",
        status: "queued",
        user_language: userLang,
      });
    }

    await supabase.from("deliveries").insert({
      user_id: ctx.user.id,
      video_id: videoId,
      status: "pending",
      language: userLang,
    });

    return { ok: true, queued: true };
  });

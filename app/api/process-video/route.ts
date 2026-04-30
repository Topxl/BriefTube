import { authRoute } from "@/lib/zod-route";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { queueVideoForProcessing } from "@/lib/video-queue";
import { checkRateLimit, heavyRateLimit } from "@/lib/rate-limit";
import { extractVideoId } from "@/lib/youtube-id";
import { NextResponse } from "next/server";

/**
 * Resolve the real YouTube title via oEmbed when the client didn't have time
 * to fetch it (e.g. user clicked Summarize before the link-preview returned).
 * Falls back to the videoId so we never block the queue on a network failure.
 */
async function resolveVideoTitle(videoId: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: controller.signal },
    );
    if (!res.ok) return videoId;
    const data = (await res.json()) as { title?: string };
    return data.title?.trim() || videoId;
  } catch {
    return videoId;
  } finally {
    clearTimeout(timer);
  }
}

export const POST = authRoute
  .body(
    z.object({
      // Accept either a raw video ID or any YouTube URL — we'll normalize
      videoId: z.string().min(1),
      videoTitle: z.string().optional(),
      language: z.string().optional(),
    }),
  )
  .handler(async (_req, { body, ctx }) => {
    const rl = await checkRateLimit(heavyRateLimit, ctx.user.id);
    if (rl) return rl;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const {
      videoId: rawInput,
      videoTitle,
      language,
    } = body as {
      videoId: string;
      videoTitle?: string;
      language?: string;
    };

    // Normalize: accept full URLs, short URLs, or raw IDs
    const videoId = extractVideoId(rawInput);
    if (!videoId) {
      return NextResponse.json(
        { error: "Could not extract a valid YouTube video ID from the input" },
        { status: 400 },
      );
    }

    // Get user language (user session is fine for reading profiles)
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", ctx.user.id)
      .single();
    const userLang = language ?? profile?.preferred_language ?? "fr";

    // Resolve the real title via oEmbed when the client didn't pass one or
    // passed the raw videoId (happens when user clicks Summarize before the
    // link-preview has resolved). Otherwise the processing card and the
    // resulting summary card show "dIGd9RfCz4Q" instead of the real title.
    const hasRealTitle = videoTitle && videoTitle !== videoId;
    const finalTitle = hasRealTitle
      ? videoTitle
      : await resolveVideoTitle(videoId);

    // Use admin client for writes — processed_videos/processing_queue/deliveries
    // have no INSERT RLS for user sessions (service_role only)
    // User-initiated summarize request → highest priority
    const { queued } = await queueVideoForProcessing(adminSupabase, {
      userId: ctx.user.id,
      videoId,
      videoTitle: finalTitle,
      channelId: "",
      userLang,
      priority: 100,
    });

    return { ok: true, queued, videoId, videoTitle: finalTitle };
  });

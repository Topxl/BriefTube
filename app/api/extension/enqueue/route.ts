import { NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, extensionRoute } from "@/lib/extension-route";
import { createAdminClient } from "@/lib/supabase/server";
import { queueVideoForProcessing } from "@/lib/video-queue";
import { getUserQuotaSnapshot } from "@/lib/extension-quota";
import { authRateLimit, checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  videoId: z.string().min(6).max(20),
  videoTitle: z.string().max(500).optional(),
  channelId: z.string().max(100).optional(),
  targetLanguage: z.string().max(10).optional(),
});
type Body = z.infer<typeof bodySchema>;

export const OPTIONS = corsPreflight;

/**
 * Fallback endpoint when the extension can't extract a transcript client-side
 * (no captions on the video). Enqueues the video in the worker pipeline so it
 * runs through Whisper transcription + Gemini summarization.
 * Only authenticated users (worker costs ~$0.01 per Whisper run).
 */
export const POST = extensionRoute
  .requireAuthenticated()
  .body(bodySchema)
  .handler(async (_req, { body, user }) => {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { videoId, videoTitle, channelId, targetLanguage } = body as Body;

    const rl = await checkRateLimit(authRateLimit, `ext-enqueue:${user.id}`);
    if (rl) return rl;

    const quota = await getUserQuotaSnapshot(user.id);
    if (!quota.isPro && quota.remaining <= 0) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          message: "Daily free limit reached. Upgrade to Pro for unlimited.",
          quota,
        },
        { status: 402 },
      );
    }

    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", user.id)
      .single();
    const userLang = targetLanguage ?? profile?.preferred_language ?? "en";

    const { queued } = await queueVideoForProcessing(supabase, {
      userId: user.id,
      videoId,
      videoTitle: videoTitle ?? videoId,
      channelId: channelId ?? "",
      userLang,
      priority: 100,
    });

    return { ok: true, queued, videoId, language: userLang };
  });

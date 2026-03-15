import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { queueVideoForProcessing } from "@/lib/video-queue";

export const POST = authRoute
  .body(z.object({ videoId: z.string(), videoTitle: z.string().optional() }))
  .handler(async (_req, { body, ctx }) => {
    const supabase = await createClient();
    const { videoId, videoTitle } = body as {
      videoId: string;
      videoTitle?: string;
    };

    // Get user language
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", ctx.user.id)
      .single();
    const userLang = profile?.preferred_language ?? "fr";

    const { queued } = await queueVideoForProcessing(supabase, {
      userId: ctx.user.id,
      videoId,
      videoTitle: videoTitle ?? videoId,
      channelId: "",
      userLang,
    });

    return { ok: true, queued };
  });

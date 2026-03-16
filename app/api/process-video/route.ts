import { authRoute } from "@/lib/zod-route";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { queueVideoForProcessing } from "@/lib/video-queue";

export const POST = authRoute
  .body(z.object({ videoId: z.string(), videoTitle: z.string().optional() }))
  .handler(async (_req, { body, ctx }) => {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { videoId, videoTitle } = body as {
      videoId: string;
      videoTitle?: string;
    };

    // Get user language (user session is fine for reading profiles)
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", ctx.user.id)
      .single();
    const userLang = profile?.preferred_language ?? "fr";

    // Use admin client for writes — processed_videos/processing_queue/deliveries
    // have no INSERT RLS for user sessions (service_role only)
    const { queued } = await queueVideoForProcessing(adminSupabase, {
      userId: ctx.user.id,
      videoId,
      videoTitle: videoTitle ?? videoId,
      channelId: "",
      userLang,
    });

    return { ok: true, queued };
  });

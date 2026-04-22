import { NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, extensionRoute } from "@/lib/extension-route";
import { createAdminClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/subscriptions";
import { authRateLimit, checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  channelId: z.string().min(1).max(100),
  channelName: z.string().min(1).max(500),
  channelAvatarUrl: z.string().url().max(2000).optional(),
});
type Body = z.infer<typeof bodySchema>;

export const OPTIONS = corsPreflight;

/**
 * Subscribe to a YouTube channel directly from the extension.
 * Killer feature vs Eightify: one-click adds the channel to the user's
 * BriefTube subscriptions, enabling automatic summaries on new videos.
 */
export const POST = extensionRoute
  .requireAuthenticated()
  .body(bodySchema)
  .handler(async (_req, { body, user }) => {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { channelId, channelName, channelAvatarUrl } = body as Body;

    const rl = await checkRateLimit(authRateLimit, `ext-sub:${user.id}`);
    if (rl) return rl;

    const supabase = createAdminClient();
    const plan = await getUserPlan(supabase, user.id);

    const { count } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("active", true);

    const activeCount = count ?? 0;
    if (activeCount >= plan.maxChannels) {
      return NextResponse.json(
        {
          error: "channel_limit_reached",
          message: `You've reached the ${plan.maxChannels}-channel limit. Upgrade to add more.`,
          limit: plan.maxChannels,
          current: activeCount,
        },
        { status: 402 },
      );
    }

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id, active, channel_avatar_url")
      .eq("user_id", user.id)
      .eq("channel_id", channelId)
      .maybeSingle();

    if (existing) {
      if (!existing.active) {
        await supabase
          .from("subscriptions")
          .update({
            active: true,
            paused_by_system: false,
            channel_avatar_url: channelAvatarUrl ?? existing.channel_avatar_url,
          })
          .eq("id", existing.id);
      } else if (channelAvatarUrl && !existing.channel_avatar_url) {
        await supabase
          .from("subscriptions")
          .update({ channel_avatar_url: channelAvatarUrl })
          .eq("id", existing.id);
      }
      return { ok: true, subscription: existing.id, alreadySubscribed: true };
    }

    const insertRes = await supabase
      .from("subscriptions")
      .insert({
        user_id: user.id,
        channel_id: channelId,
        channel_name: channelName,
        channel_avatar_url: channelAvatarUrl ?? null,
        active: true,
        source_type: "extension",
      })
      .select("id")
      .single();

    if (insertRes.error) {
      return NextResponse.json(
        { error: "insert_failed", details: insertRes.error.message },
        { status: 500 },
      );
    }

    return {
      ok: true,
      subscription: insertRes.data.id,
      alreadySubscribed: false,
    };
  });

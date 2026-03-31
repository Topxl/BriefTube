import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string(),
    p256dh: z.string(),
  }),
});

type Body = z.infer<typeof bodySchema>;

export const POST = authRoute
  .body(bodySchema)
  .handler(async (req, { body, ctx }) => {
    const rateLimitResponse = await checkRateLimit(authRateLimit, `push-sub:${ctx.user.id}`);
    if (rateLimitResponse) return rateLimitResponse;

    const { endpoint, keys } = body as Body;
    const supabase = await createClient();

    await supabase.from("push_subscriptions").upsert(
      {
        user_id: ctx.user.id,
        endpoint,
        keys_auth: keys.auth,
        keys_p256dh: keys.p256dh,
        user_agent: req.headers.get("user-agent") ?? undefined,
      },
      { onConflict: "endpoint" },
    );

    await supabase
      .from("profiles")
      .update({ notify_new_summaries_push: true })
      .eq("id", ctx.user.id);

    return { success: true };
  });

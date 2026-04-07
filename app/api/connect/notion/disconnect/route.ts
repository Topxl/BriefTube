import { authRoute } from "@/lib/zod-route";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/posthog/server";

export const POST = authRoute.handler(async (_req, { ctx }) => {
  const rateLimitResponse = await checkRateLimit(
    authRateLimit,
    `notion-dc:${ctx.user.id}`,
  );
  if (rateLimitResponse) return rateLimitResponse;

  const supabase = await createClient();
  await supabase
    .from("platform_connections")
    .update({ connected: false })
    .eq("user_id", ctx.user.id)
    .eq("platform", "notion");

  captureServerEvent({
    distinctId: ctx.user.id,
    event: "platform_disconnected",
    properties: { platform: "notion" },
  });

  return { ok: true };
});

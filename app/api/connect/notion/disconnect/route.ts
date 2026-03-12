import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";

export const POST = authRoute.handler(async (_req, { ctx }) => {
  const supabase = await createClient();
  await supabase
    .from("platform_connections")
    .update({ connected: false })
    .eq("user_id", ctx.user.id)
    .eq("platform", "notion");
  return { ok: true };
});

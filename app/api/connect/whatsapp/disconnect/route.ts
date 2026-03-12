import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const POST = authRoute
  .body(z.object({}))
  .handler(async (_req, { ctx }) => {
    const supabase = await createClient();
    await supabase
      .from("platform_connections")
      .update({ connected: false })
      .eq("user_id", ctx.user.id)
      .eq("platform", "whatsapp");
    return { ok: true };
  });

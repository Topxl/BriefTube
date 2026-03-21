import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const POST = authRoute
  .body(
    z.object({
      webhookUrl: z
        .string()
        .url()
        .refine((u) => u.startsWith("https://discord.com/api/webhooks/"), {
          message: "Must be a Discord webhook URL",
        }),
    }),
  )
  .handler(async (_req, { body, ctx }) => {
    const supabase = await createClient();
    const { webhookUrl } = body as { webhookUrl: string };
    await supabase.from("platform_connections").upsert(
      {
        user_id: ctx.user.id,
        platform: "discord",
        external_id: webhookUrl,
        connected: true,
      },
      { onConflict: "user_id,platform" },
    );
    return { ok: true };
  });

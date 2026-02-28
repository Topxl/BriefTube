import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const bodySchema = z.object({
  endpoint: z.string(),
});

type Body = z.infer<typeof bodySchema>;

export const POST = authRoute
  .body(bodySchema)
  .handler(async (_req, { body, ctx }) => {
    const { endpoint } = body as Body;
    const supabase = await createClient();

    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", ctx.user.id)
      .eq("endpoint", endpoint);

    return { success: true };
  });

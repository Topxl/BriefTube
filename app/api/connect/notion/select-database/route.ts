import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const bodySchema = z.object({
  databaseId: z.string().min(1),
  databaseName: z.string().optional(),
  accessToken: z.string().min(1),
  workspaceId: z.string().min(1),
  workspaceName: z.string().optional(),
});

type Body = z.infer<typeof bodySchema>;

export const POST = authRoute
  .body(bodySchema)
  .handler(async (_req, { body, ctx }) => {
    const parsedBody = body as Body;
    const supabase = await createClient();
    await supabase.from("platform_connections").upsert(
      {
        user_id: ctx.user.id,
        platform: "notion",
        external_id: parsedBody.workspaceId,
        credentials: {
          access_token: parsedBody.accessToken,
          database_id: parsedBody.databaseId,
          database_name: parsedBody.databaseName ?? "",
          workspace_name: parsedBody.workspaceName ?? "",
        },
        connected: true,
      },
      { onConflict: "user_id,platform" },
    );
    return { ok: true };
  });

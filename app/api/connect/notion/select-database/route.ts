import { authRoute } from "@/lib/zod-route";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { captureServerEvent } from "@/lib/posthog/server";

const NOTION_PENDING_TOKEN_COOKIE = "notion_pending_token";

const bodySchema = z.object({
  databaseId: z.string().min(1),
  databaseName: z.string().optional(),
  workspaceId: z.string().min(1),
  workspaceName: z.string().optional(),
});

type Body = z.infer<typeof bodySchema>;

export const POST = authRoute
  .body(bodySchema)
  .handler(async (_req, { body, ctx }) => {
    const rateLimitResponse = await checkRateLimit(authRateLimit, `notion-db:${ctx.user.id}`);
    if (rateLimitResponse) return rateLimitResponse;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(NOTION_PENDING_TOKEN_COOKIE)?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Session expirée, veuillez reconnecter Notion" },
        { status: 400 },
      );
    }

    const parsedBody = body as Body;
    const supabase = await createClient();
    await supabase.from("platform_connections").upsert(
      {
        user_id: ctx.user.id,
        platform: "notion",
        external_id: parsedBody.workspaceId,
        credentials: {
          access_token: accessToken,
          database_id: parsedBody.databaseId,
          database_name: parsedBody.databaseName ?? "",
          workspace_name: parsedBody.workspaceName ?? "",
        },
        connected: true,
      },
      { onConflict: "user_id,platform" },
    );

    await captureServerEvent({
      distinctId: ctx.user.id,
      event: "platform_connected",
      properties: { platform: "notion" },
    });

    // Clear the pending token cookie
    cookieStore.delete(NOTION_PENDING_TOKEN_COOKIE);

    return { ok: true };
  });

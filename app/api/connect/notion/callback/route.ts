import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
import { createHmac } from "crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { captureServerEvent } from "@/lib/posthog/server";

const NOTION_PENDING_TOKEN_COOKIE = "notion_pending_token";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (!code || !stateParam) {
    redirect("/dashboard?error=notion_missing_params");
  }

  // Validate HMAC state
  const [userId, stateHash] = stateParam.split(".");
  if (!userId || !stateHash) {
    redirect("/dashboard?error=notion_invalid_state");
  }

  if (!env.NOTION_CLIENT_SECRET) {
    throw new Error("NOTION_CLIENT_SECRET is not set");
  }

  const expectedHash = createHmac("sha256", env.NOTION_CLIENT_SECRET)
    .update(userId)
    .digest("hex");

  if (stateHash !== expectedHash) {
    redirect("/dashboard?error=notion_invalid_state");
  }

  // Get authenticated user from session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const rateLimitResponse = await checkRateLimit(authRateLimit, `notion-cb:${user.id}`);
  if (rateLimitResponse) return rateLimitResponse;

  if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) {
    throw new Error("NOTION_CLIENT_ID or NOTION_CLIENT_SECRET is not set");
  }

  // Exchange code for access_token
  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.NOTION_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    redirect("/dashboard?error=notion_token_exchange_failed");
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    workspace_id: string;
    workspace_name: string;
    bot_id: string;
  };

  // Search for accessible databases
  const searchRes = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filter: { value: "database", property: "object" } }),
  });

  const searchData = (await searchRes.json()) as {
    results: { id: string; title: { plain_text: string }[] }[];
  };

  const databases = searchData.results.map((db) => ({
    id: db.id,
    title: db.title[0]?.plain_text ?? "Untitled",
  }));

  if (databases.length === 1) {
    // Auto-select the only database
    const db = databases[0];
    await supabase.from("platform_connections").upsert(
      {
        user_id: user.id,
        platform: "notion",
        external_id: tokenData.workspace_id,
        credentials: {
          access_token: tokenData.access_token,
          database_id: db.id,
          database_name: db.title,
          workspace_name: tokenData.workspace_name,
        },
        connected: true,
      },
      { onConflict: "user_id,platform" },
    );
    await captureServerEvent({
      distinctId: user.id,
      event: "platform_connected",
      properties: { platform: "notion" },
    });

    redirect("/dashboard/profile?notion=connected");
  }

  // Multiple databases — store token in a short-lived httpOnly cookie, keep only non-sensitive data in URL
  const cookieStore = await cookies();
  cookieStore.set(NOTION_PENDING_TOKEN_COOKIE, tokenData.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const dbsParam = encodeURIComponent(JSON.stringify(databases));
  const wsId = encodeURIComponent(tokenData.workspace_id);
  const wsName = encodeURIComponent(tokenData.workspace_name);
  redirect(
    `/dashboard/profile?notion=select_db&dbs=${dbsParam}&ws_id=${wsId}&ws_name=${wsName}`,
  );
}

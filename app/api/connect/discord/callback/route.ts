import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { createHmac } from "crypto";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (!code || !stateParam) {
    redirect("/dashboard/profile?error=discord_missing_params");
  }

  // Validate HMAC state
  const [userId, stateHash] = stateParam.split(".");
  if (!userId || !stateHash) {
    redirect("/dashboard/profile?error=discord_invalid_state");
  }

  const expectedHash = createHmac(
    "sha256",
    env.DISCORD_CLIENT_SECRET ?? "secret",
  )
    .update(userId)
    .digest("hex");

  if (stateHash !== expectedHash) {
    redirect("/dashboard/profile?error=discord_invalid_state");
  }

  // Exchange code for token — response includes webhook object
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID ?? "",
      client_secret: env.DISCORD_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: env.DISCORD_REDIRECT_URI ?? "",
    }),
  });

  if (!tokenRes.ok) {
    redirect("/dashboard/profile?error=discord_token_exchange_failed");
  }

  const tokenData = (await tokenRes.json()) as {
    webhook?: {
      id: string;
      token: string;
      url?: string;
      guild_id?: string;
      channel_id?: string;
      name?: string;
    };
  };

  const webhook = tokenData.webhook;
  if (!webhook?.id || !webhook.token) {
    redirect("/dashboard/profile?error=discord_no_webhook");
  }

  const webhookUrl =
    webhook.url ??
    `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;

  const supabase = await createClient();
  await supabase.from("platform_connections").upsert(
    {
      user_id: userId,
      platform: "discord",
      external_id: webhookUrl,
      credentials: {
        webhook_id: webhook.id,
        channel_id: webhook.channel_id ?? null,
        guild_id: webhook.guild_id ?? null,
        name: webhook.name ?? null,
      },
      connected: true,
    },
    { onConflict: "user_id,platform" },
  );

  redirect("/dashboard/profile?discord=connected");
}

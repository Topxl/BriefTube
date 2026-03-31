import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
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

  if (!env.DISCORD_CLIENT_SECRET) {
    throw new Error("DISCORD_CLIENT_SECRET is not set");
  }

  const expectedHash = createHmac("sha256", env.DISCORD_CLIENT_SECRET)
    .update(userId)
    .digest("hex");

  if (stateHash !== expectedHash) {
    redirect("/dashboard/profile?error=discord_invalid_state");
  }

  // Get authenticated user from session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const rateLimitResponse = await checkRateLimit(authRateLimit, `discord-cb:${user.id}`);
  if (rateLimitResponse) return rateLimitResponse;

  // Exchange code for token — response includes webhook object
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID ?? "",
      client_secret: env.DISCORD_CLIENT_SECRET,
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

  await supabase.from("platform_connections").upsert(
    {
      user_id: user.id,
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

  // Send a welcome message to confirm the channel is working
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "BriefTube",
      embeds: [
        {
          title: "BriefTube connected",
          description:
            "This channel will receive your audio summaries as soon as a subscribed YouTube channel publishes a new video.",
          color: 0xdc2626,
          fields: [
            {
              name: "What to expect",
              value:
                "Each summary includes the video title, a text excerpt, and a link to listen to the full audio.",
            },
          ],
        },
      ],
    }),
  }).catch(() => {
    // Non-blocking — don't fail the redirect if the message fails
  });

  redirect("/dashboard/profile?discord=connected");
}

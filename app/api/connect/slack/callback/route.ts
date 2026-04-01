import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
import { createHmac } from "crypto";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { captureServerEvent } from "@/lib/posthog/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (!code || !stateParam) {
    redirect("/dashboard/profile?error=slack_missing_params");
  }

  // Validate HMAC state
  const [userId, stateHash] = stateParam.split(".");
  if (!userId || !stateHash) {
    redirect("/dashboard/profile?error=slack_invalid_state");
  }

  if (!env.SLACK_CLIENT_SECRET) {
    throw new Error("SLACK_CLIENT_SECRET is not set");
  }

  const expectedHash = createHmac("sha256", env.SLACK_CLIENT_SECRET)
    .update(userId)
    .digest("hex");

  if (stateHash !== expectedHash) {
    redirect("/dashboard/profile?error=slack_invalid_state");
  }

  // Get authenticated user from session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const rateLimitResponse = await checkRateLimit(authRateLimit, `slack-cb:${user.id}`);
  if (rateLimitResponse) return rateLimitResponse;

  // Exchange code for access token
  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID ?? "",
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI ?? "",
    }),
  });

  if (!tokenRes.ok) {
    redirect("/dashboard/profile?error=slack_token_exchange_failed");
  }

  const tokenData = (await tokenRes.json()) as {
    ok: boolean;
    incoming_webhook?: {
      url: string;
      channel: string;
      channel_id: string;
      configuration_url: string;
    };
    team?: { id: string; name: string };
  };

  if (!tokenData.ok || !tokenData.incoming_webhook?.url) {
    redirect("/dashboard/profile?error=slack_no_webhook");
  }

  const webhookUrl = tokenData.incoming_webhook.url;

  await supabase.from("platform_connections").upsert(
    {
      user_id: user.id,
      platform: "slack",
      external_id: webhookUrl,
      credentials: {
        channel: tokenData.incoming_webhook.channel,
        channel_id: tokenData.incoming_webhook.channel_id,
        team_name: tokenData.team?.name ?? null,
        team_id: tokenData.team?.id ?? null,
      },
      connected: true,
    },
    { onConflict: "user_id,platform" },
  );

  captureServerEvent({
    distinctId: user.id,
    event: "platform_connected",
    properties: { platform: "slack" },
  });

  // Send a welcome message to confirm the channel is working
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*BriefTube connected* :white_check_mark:",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "This channel will receive your audio summaries as soon as a subscribed YouTube channel publishes a new video.\n\nEach summary includes the video title, a text excerpt, and a button to listen to the full audio.",
          },
        },
      ],
    }),
  }).catch(() => {
    // Non-blocking — don't fail the redirect if the message fails
  });

  redirect("/dashboard/profile?slack=connected");
}

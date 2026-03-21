import { getRequiredUser } from "@/lib/auth/auth-user";
import { env } from "@/lib/env";
import { createHmac } from "crypto";
import { redirect } from "next/navigation";

export async function GET() {
  const user = await getRequiredUser();

  if (!env.SLACK_CLIENT_ID || !env.SLACK_REDIRECT_URI) {
    redirect("/dashboard/profile?error=slack_not_configured");
  }

  const state = createHmac("sha256", env.SLACK_CLIENT_SECRET ?? "secret")
    .update(user.id)
    .digest("hex");

  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: "incoming-webhook",
    redirect_uri: env.SLACK_REDIRECT_URI,
    state: `${user.id}.${state}`,
  });

  redirect(`https://slack.com/oauth/v2/authorize?${params}`);
}

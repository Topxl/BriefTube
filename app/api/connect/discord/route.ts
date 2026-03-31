import { getRequiredUser } from "@/lib/auth/auth-user";
import { env } from "@/lib/env";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
import { createHmac } from "crypto";
import { redirect } from "next/navigation";

export async function GET() {
  const user = await getRequiredUser();

  const rateLimitResponse = await checkRateLimit(authRateLimit, `discord:${user.id}`);
  if (rateLimitResponse) return rateLimitResponse;

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_REDIRECT_URI) {
    redirect("/dashboard/profile?error=discord_not_configured");
  }

  if (!env.DISCORD_CLIENT_SECRET) {
    throw new Error("DISCORD_CLIENT_SECRET is not set");
  }

  const state = createHmac("sha256", env.DISCORD_CLIENT_SECRET)
    .update(user.id)
    .digest("hex");

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "webhook.incoming",
    state: `${user.id}.${state}`,
  });

  redirect(`https://discord.com/api/oauth2/authorize?${params}`);
}

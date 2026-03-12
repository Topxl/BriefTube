import { getRequiredUser } from "@/lib/auth/auth-user";
import { env } from "@/lib/env";
import { createHmac } from "crypto";
import { redirect } from "next/navigation";

export async function GET() {
  const user = await getRequiredUser();

  if (!env.NOTION_CLIENT_ID || !env.NOTION_REDIRECT_URI) {
    redirect("/dashboard?error=notion_not_configured");
  }

  // HMAC state to prevent CSRF
  const state = createHmac("sha256", env.NOTION_CLIENT_SECRET ?? "secret")
    .update(user.id)
    .digest("hex");

  const params = new URLSearchParams({
    client_id: env.NOTION_CLIENT_ID,
    response_type: "code",
    owner: "user",
    redirect_uri: env.NOTION_REDIRECT_URI,
    state: `${user.id}.${state}`,
  });

  redirect(`https://api.notion.com/v1/oauth/authorize?${params}`);
}

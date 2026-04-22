import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
import { getBaseUrl } from "@/lib/server-url";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseUrl = getBaseUrl(request);

  if (!user) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const rateLimitResponse = await checkRateLimit(
    authRateLimit,
    `youtube-auth:${user.id}`,
  );
  if (rateLimitResponse) return rateLimitResponse;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 },
    );
  }

  // Support ?mode=sync to trigger sync diff flow instead of import
  const mode = request.nextUrl.searchParams.get("mode") ?? "import";

  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("youtube_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });
  // Store mode so callback knows whether to import or sync-diff
  cookieStore.set("youtube_oauth_mode", mode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });

  // Only force `prompt=consent` when we don't yet have a refresh_token stored.
  // Google issues a refresh_token only on a fresh consent — required the first
  // time so we can silent-sync later. On re-auth (token revoked, etc.) we omit
  // `prompt`: the user breezes through if their Google session is still active,
  // and Google won't send a "you authorized X" security email each time.
  const { data: profile } = await supabase
    .from("profiles")
    .select("youtube_refresh_token")
    .eq("id", user.id)
    .single();
  const hasRefreshToken = !!profile?.youtube_refresh_token;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl}/api/youtube/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline",
    state,
  });
  if (!hasRefreshToken) {
    params.set("prompt", "consent");
  }

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}

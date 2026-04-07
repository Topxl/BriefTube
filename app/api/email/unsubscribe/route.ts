import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyUnsubscribeToken } from "@/lib/mail/unsubscribe";
import {
  checkRateLimit,
  getRequestIp,
  publicRateLimit,
} from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(
    publicRateLimit,
    `unsub:${getRequestIp(request)}`,
  );
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("uid");
  const emailType = searchParams.get("type");
  const token = searchParams.get("token");

  if (!userId || !emailType || !token) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  if (!verifyUnsubscribeToken(userId, emailType, token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Map email type to profile field
  let updatePayload:
    | { newsletter_enabled: boolean }
    | { email_announcements: boolean }
    | { email_newsletter: boolean }
    | null = null;

  if (emailType === "newsletter") {
    updatePayload = { newsletter_enabled: false };
  } else if (emailType === "announcements") {
    updatePayload = { email_announcements: false };
  } else if (emailType === "digest") {
    updatePayload = { email_newsletter: false };
  }

  if (!updatePayload) {
    return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
  }

  await supabase.from("profiles").update(updatePayload).eq("id", userId);

  // Redirect to a confirmation page or show a simple message
  return new NextResponse(
    `<html><body style="background:#0f0f0f;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>Unsubscribed</h2><p>You've been unsubscribed from ${emailType} emails.</p><a href="https://www.brief-tube.com/dashboard/profile" style="color:#dc2626">Manage preferences</a></div></body></html>`,
    { headers: { "Content-Type": "text/html" } },
  );
}

// POST handler for one-click unsubscribe (RFC 8058)
export async function POST(request: NextRequest) {
  return GET(request);
}

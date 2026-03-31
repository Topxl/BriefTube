import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail/send-email";
import { FirstSummaryEmail } from "@/components/emails/first-summary-email";
import { SiteConfig } from "@/site-config";
import { checkRateLimit, getRequestIp, publicRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  userId: z.string().uuid(),
  videoId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const rateLimitResponse = await checkRateLimit(publicRateLimit, `first-summary:${getRequestIp(req)}`);
  if (rateLimitResponse) return rateLimitResponse;

  const secret = req.headers.get("x-push-secret");
  if (!secret || !env.PUSH_NOTIFY_SECRET || secret !== env.PUSH_NOTIFY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    const raw = await req.json();
    parsed = bodySchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Dedup — only send once per user lifetime
  const { data: existing } = await supabase
    .from("email_logs")
    .select("id")
    .eq("user_id", parsed.userId)
    .eq("email_type", "first_summary")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ skipped: true });
  }

  // Get user email
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", parsed.userId)
    .single();

  if (!profile?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get video title
  const { data: video } = await supabase
    .from("processed_videos")
    .select("video_title")
    .eq("video_id", parsed.videoId)
    .limit(1)
    .maybeSingle();

  const videoTitle = video?.video_title ?? "a video from your channel";
  const dashboardUrl = `${SiteConfig.prodUrl}/dashboard?video=${parsed.videoId}`;

  await sendEmail({
    to: profile.email,
    subject: "Your first BriefTube summary is ready",
    html: FirstSummaryEmail({ videoTitle, dashboardUrl }),
  });

  await supabase.from("email_logs").insert({
    user_id: parsed.userId,
    email_type: "first_summary",
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ sent: true });
}

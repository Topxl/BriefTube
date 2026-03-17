import { render } from "@react-email/render";
import { createAdminClient } from "@/lib/supabase/server";
import { resend } from "@/lib/mail/resend";
import { env } from "@/lib/env";
import { SiteConfig } from "@/site-config";
import { DailyNewsletterEmail } from "@email/daily-newsletter";

type NewsletterVideo = {
  videoId: string;
  title: string;
  youtubeUrl: string;
  summary: string;
  briefUrl: string;
};

type DigestResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  count?: number;
};

export async function runDailyDigestForUser(
  userId: string,
  email: string,
  language: string,
  windowHours = 24,
): Promise<DigestResult> {
  const supabase = createAdminClient();
  const since = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("video_id, language")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (!deliveries || deliveries.length === 0) {
    return { sent: false, skipped: true, reason: "no deliveries in window" };
  }

  const videoIds = [...new Set(deliveries.map((d) => d.video_id))];
  const deliveryLanguages = [...new Set(deliveries.map((d) => d.language))];

  const { data: pvideos } = await supabase
    .from("processed_videos")
    .select("video_id, language, video_title, video_url, summary")
    .in("video_id", videoIds)
    .in("language", deliveryLanguages)
    .eq("status", "completed");

  if (!pvideos) {
    return { sent: false, skipped: true, reason: "no processed videos" };
  }

  const map = new Map<string, (typeof pvideos)[number]>();
  for (const v of pvideos) {
    map.set(`${v.video_id}:${v.language}`, v);
    if (!map.has(v.video_id)) map.set(v.video_id, v);
  }

  const videos = deliveries
    .map((d) => {
      const v = map.get(`${d.video_id}:${d.language}`) ?? map.get(d.video_id);
      if (!v?.video_title || !v.summary) return null;
      return {
        videoId: d.video_id,
        title: v.video_title,
        youtubeUrl: v.video_url ?? `https://youtube.com/watch?v=${d.video_id}`,
        summary: v.summary,
        briefUrl: `${SiteConfig.prodUrl}/videos/${d.video_id}`,
      } satisfies NewsletterVideo;
    })
    .filter((v): v is NewsletterVideo => v !== null);

  if (videos.length === 0) {
    return { sent: false, skipped: true, reason: "no videos with summaries" };
  }

  const date = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const html = await render(
    DailyNewsletterEmail({
      videos,
      date,
      unsubscribeUrl: `${SiteConfig.prodUrl}/dashboard/profile`,
      language,
    }),
  );

  await resend.emails.send({
    from: env.EMAIL_FROM ?? `BriefTube <hello@${SiteConfig.domain}>`,
    to: email,
    subject: `[TEST] Digest — ${date}`,
    html,
  });

  await supabase.from("email_logs").insert({
    user_id: userId,
    email_type: "daily_digest",
    sent_at: new Date().toISOString(),
  });

  return { sent: true, skipped: false, count: videos.length };
}

import { render } from "@react-email/render";
import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/server";
import { resend } from "@/lib/mail/resend";
import { env } from "@/lib/env";
import { SiteConfig } from "@/site-config";
import { DailyNewsletterEmail } from "@email/daily-newsletter";

// ---------------------------------------------------------------------------
// Type for a video entry in the newsletter
// ---------------------------------------------------------------------------

type NewsletterVideo = {
  videoId: string;
  title: string;
  youtubeUrl: string;
  summary: string;
  briefUrl: string;
};

// ---------------------------------------------------------------------------
// Function 1 — Cron trigger (every hour, UTC)
// Finds users whose newsletter_hour matches current UTC hour and fans out.
// ---------------------------------------------------------------------------

export const dailyNewsletterTrigger = inngest.createFunction(
  { id: "newsletter-daily-trigger" },
  { cron: "TZ=UTC 0 * * * *" },
  async ({ step }) => {
    const currentHour = new Date().getUTCHours();

    const users = await step.run("fetch-eligible-users", async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, email, preferred_language")
        .eq("newsletter_enabled", true)
        .eq("newsletter_hour", currentHour);
      return (data ?? []).filter((u) => !!u.email);
    });

    if (users.length === 0) return { queued: 0 };

    await step.sendEvent(
      "fan-out-user-newsletters",
      users.map((u) => ({
        name: "newsletter/send-user" as const,
        data: {
          userId: u.id,
          email: u.email,
          language: u.preferred_language ?? "fr",
        },
      })),
    );

    return { queued: users.length };
  },
);

// ---------------------------------------------------------------------------
// Function 2 — Per-user send (triggered by fan-out event)
// Fetches last 24h deliveries, renders email, sends via Resend.
// ---------------------------------------------------------------------------

export const sendUserNewsletter = inngest.createFunction(
  { id: "newsletter-send-user", retries: 2 },
  { event: "newsletter/send-user" },
  async ({ event, step }) => {
    const { userId, email, language } = event.data as {
      userId: string;
      email: string;
      language: string;
    };

    const videos = await step.run("fetch-deliveries", async () => {
      const supabase = createAdminClient();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("video_id, language")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (!deliveries || deliveries.length === 0) return [];

      const videoIds = [...new Set(deliveries.map((d) => d.video_id))];
      const deliveryLanguages = [...new Set(deliveries.map((d) => d.language))];

      // Same two-step approach as summaries-feed (processed_videos has composite key)
      const { data: pvideos } = await supabase
        .from("processed_videos")
        .select("video_id, language, video_title, video_url, summary")
        .in("video_id", videoIds)
        .in("language", deliveryLanguages)
        .eq("status", "completed");

      if (!pvideos) return [];

      const map = new Map<string, (typeof pvideos)[number]>();
      for (const v of pvideos) {
        map.set(`${v.video_id}:${v.language}`, v);
        if (!map.has(v.video_id)) map.set(v.video_id, v);
      }

      return deliveries
        .map((d) => {
          const v =
            map.get(`${d.video_id}:${d.language}`) ?? map.get(d.video_id);
          if (!v?.video_title || !v.summary) return null;
          return {
            videoId: d.video_id,
            title: v.video_title,
            youtubeUrl:
              v.video_url ?? `https://youtube.com/watch?v=${d.video_id}`,
            summary: v.summary,
            briefUrl: `${SiteConfig.prodUrl}/videos/${d.video_id}`,
          } satisfies NewsletterVideo;
        })
        .filter((v): v is NewsletterVideo => v !== null);
    });

    if (videos.length === 0) {
      return { skipped: true, reason: "no summaries in last 24h" };
    }

    await step.run("send-email", async () => {
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
        subject: `Tes résumés du jour — ${date}`,
        html,
      });
    });

    return { sent: true, count: videos.length };
  },
);

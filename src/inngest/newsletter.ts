import { render } from "@react-email/render";
import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send-email";
import { env } from "@/lib/env";
import { SiteConfig } from "@/site-config";
import { DailyNewsletterEmail } from "@email/daily-newsletter";
import { getUnsubscribeHeaders } from "@/lib/mail/unsubscribe";

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
// Function 1: Cron trigger (every hour, UTC)
// Finds users whose newsletter_hour matches current UTC hour and fans out.
// ---------------------------------------------------------------------------

export const dailyNewsletterTrigger = inngest.createFunction(
  {
    id: "newsletter-daily-trigger",
    triggers: [{ cron: "TZ=UTC 0 * * * *" }],
  },
  async ({ step }) => {
    const currentHour = new Date().getUTCHours();

    const users = await step.run("fetch-eligible-users", async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, email, preferred_language, newsletter_full_summary")
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
          fullSummary: u.newsletter_full_summary,
        },
      })),
    );

    return { queued: users.length };
  },
);

// ---------------------------------------------------------------------------
// Function 2: Per-user send (triggered by fan-out event)
// Fetches last 24h deliveries, renders email, sends via Resend.
// ---------------------------------------------------------------------------

export const sendUserNewsletter = inngest.createFunction(
  {
    id: "newsletter-send-user",
    retries: 2,
    triggers: [{ event: "newsletter/send-user" }],
  },
  async ({ event, step }) => {
    const { userId, email, language, fullSummary } = event.data as {
      userId: string;
      email: string;
      language: string;
      fullSummary?: boolean;
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

      // Deduplicate by video_id: one delivery per video regardless of platform count
      const uniqueDeliveries = deliveries.filter(
        (d, idx, arr) =>
          arr.findIndex((x) => x.video_id === d.video_id) === idx,
      );

      const videoIds = [...new Set(uniqueDeliveries.map((d) => d.video_id))];
      const deliveryLanguages = [
        ...new Set(uniqueDeliveries.map((d) => d.language)),
      ];

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

      return uniqueDeliveries
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
            briefUrl: `${SiteConfig.prodUrl}/dashboard?video=${d.video_id}`,
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
          fullSummary: fullSummary ?? false,
        }),
      );

      await sendEmail({
        from: env.EMAIL_FROM ?? `BriefTube <hello@${SiteConfig.domain}>`,
        to: email,
        subject: `your ${videos.length} summaries are ready`,
        html,
        headers: getUnsubscribeHeaders(userId, "newsletter"),
      });

      // Log to email_logs so admin dashboard can track digest sends
      const supabase = createAdminClient();
      await supabase.from("email_logs").insert({
        user_id: userId,
        email_type: "daily_digest",
        sent_at: new Date().toISOString(),
      });
    });

    return { sent: true, count: videos.length };
  },
);

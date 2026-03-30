import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { render } from "@react-email/render";
import { AnnouncementEmail } from "@/components/emails/announcement-email";
import { DailyNewsletterEmail } from "@email/daily-newsletter";
import { TrialReminderEmail } from "@/components/emails/trial-reminder-email";
import { TrialExpiredEmail } from "@/components/emails/trial-expired-email";
import { ReferralTrialEmail } from "@/components/emails/referral-trial-email";
import { founderEmail, p, signature } from "@/lib/mail/founder-email";
import { surveyEmailHtml } from "@/components/emails/survey-email";

const SAMPLE_DATE = new Date().toLocaleDateString("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

async function renderPreview(id: string): Promise<string | null> {
  switch (id) {
    case "daily_digest":
      return render(
        DailyNewsletterEmail({
          videos: [
            {
              videoId: "dQw4w9WgXcQ",
              title: "Why AI is changing everything in 2025",
              youtubeUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ",
              summary:
                "In this video, the creator explores how artificial intelligence is transforming industries at an unprecedented pace. Key points include the rise of autonomous agents, the impact on creative work, and what individuals can do to adapt in the coming years.",
              briefUrl:
                "https://www.brief-tube.com/dashboard?video=dQw4w9WgXcQ",
            },
            {
              videoId: "abc123def45",
              title: "The future of developer tools",
              youtubeUrl: "https://youtube.com/watch?v=abc123def45",
              summary:
                "A deep dive into the next generation of developer tools — from AI-powered IDEs to infrastructure-as-code solutions. The presenter argues that productivity gains in software engineering will compound over the next decade.",
              briefUrl:
                "https://www.brief-tube.com/dashboard?video=abc123def45",
            },
          ],
          date: SAMPLE_DATE,
          unsubscribeUrl: "https://www.brief-tube.com/dashboard/profile",
          language: "en",
        }),
      );
    case "trial_reminder_j3":
      return render(TrialReminderEmail({ daysLeft: 3 }));
    case "trial_reminder_j1":
      return render(TrialReminderEmail({ daysLeft: 1 }));
    case "trial_expired":
      return render(TrialExpiredEmail({}));
    case "referral_trial_j3":
      return render(ReferralTrialEmail({ daysLeft: 3, referrerName: "Alex" }));
    case "referral_trial_j1":
      return render(ReferralTrialEmail({ daysLeft: 1, referrerName: "Alex" }));
    case "activation_telegram":
      return founderEmail(
        p("Hey,") +
          p(
            "I noticed you signed up for BriefTube yesterday but haven't connected a delivery channel yet, so you haven't received any audio summaries.",
          ) +
          p(
            "I wanted to reach out personally to ask: <strong>what stopped you?</strong>",
          ) +
          p(
            "You can now connect Discord or Slack in one click, no bot setup needed. Or Telegram if you prefer. Just go here and pick what works for you: <a href='https://www.brief-tube.com/dashboard/profile' style='color:#1a1a1a;'>brief-tube.com/dashboard/profile</a>",
          ) +
          p(
            "If something else is blocking you, just hit reply and tell me. I read every response.",
          ) +
          signature(),
      );
    case "reengagement_7d":
      return founderEmail(
        p("Hey,") +
          p(
            "I checked and noticed you haven't received any BriefTube summaries in the past week.",
          ) +
          p(
            "That usually means the channels you follow haven't posted new videos recently. Completely normal for some creators.",
          ) +
          p(
            "If that's the case, it might be worth adding a few more active channels to your list. The more you track, the more summaries arrive.",
          ) +
          p(
            "You can add channels directly from your dashboard: <a href='https://www.brief-tube.com/dashboard' style='color:#1a1a1a;'>brief-tube.com/dashboard</a>",
          ) +
          p(
            "Also, is everything working fine on your end? If something broke or you're not getting summaries as expected, just reply and I'll look into it personally.",
          ) +
          signature(),
      );
    case "announcement":
      return render(AnnouncementEmail());
    case "survey_feedback":
      return surveyEmailHtml({
        surveyUrl: "https://www.brief-tube.com/survey/preview",
      });
    default:
      return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const html = await renderPreview(id);
  if (!html) {
    return new NextResponse("No preview available for this workflow", {
      status: 404,
    });
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

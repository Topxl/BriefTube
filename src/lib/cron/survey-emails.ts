import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send-email";
import { surveyEmailHtml } from "@/components/emails/survey-email";
import { SiteConfig } from "@/site-config";
import {
  getAlreadySentIds,
  insertEmailLog,
  getTrackingPixelHtml,
  type RunResult,
} from "@/lib/email/email-helpers";

const EMAIL_TYPE = "survey_feedback";

export async function runSurveyEmails(): Promise<RunResult> {
  const admin = createAdminClient();
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  // Get all users
  const { data: profiles } = await admin.from("profiles").select("id, email");

  if (!profiles?.length) return { sent, skipped, errors };

  // Get users who already responded to survey
  let respondedIds = new Set<string>();
  try {
    const { data: responded } = await admin
      .from("survey_responses")
      .select("user_id");
    if (responded?.length) {
      respondedIds = new Set(
        responded.map((r) => (r as unknown as { user_id: string }).user_id),
      );
    }
  } catch {
    // survey_responses table may not exist yet
  }

  // Get users already emailed
  const allIds = profiles.map((p) => p.id);
  const alreadySentIds = await getAlreadySentIds(admin, EMAIL_TYPE, allIds);

  // Filter eligible users
  const eligible = profiles.filter(
    (p) => !respondedIds.has(p.id) && !alreadySentIds.has(p.id) && p.email,
  );

  for (const profile of eligible) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 600)); // Throttle

      // eslint-disable-next-line no-await-in-loop
      const logId = await insertEmailLog(admin, profile.id, EMAIL_TYPE);
      const trackingPixelHtml = getTrackingPixelHtml(logId);
      const surveyUrl = `${SiteConfig.prodUrl}/survey/${profile.id}`;

      // eslint-disable-next-line no-await-in-loop
      await sendEmail({
        to: profile.email,
        subject: "Quick question about BriefTube (+ 1 free month)",
        html: surveyEmailHtml({ surveyUrl, trackingPixelHtml }),
      });

      sent++;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Survey email failed for ${profile.email}:`, e);
      errors++;
    }
  }

  skipped = profiles.length - eligible.length;
  return { sent, skipped, errors };
}

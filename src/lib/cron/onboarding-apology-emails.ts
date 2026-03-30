import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send-email";
import { founderEmail, p, signature } from "@/lib/mail/founder-email";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import type { RunResult } from "@/lib/email/email-helpers";
import {
  getAlreadySentIds,
  insertEmailLog,
  getTrackingPixelHtml,
} from "@/lib/email/email-helpers";
import { getUnsubscribeHeaders } from "@/lib/mail/unsubscribe";

const ADMIN_USER_ID = "67320a39-948c-44d2-98e3-c0de49af1ec6";

// Window: users who signed up during the period affected by the onboarding bug
const BUG_INTRODUCED_AT = new Date("2026-02-22T00:00:00Z");
const BUG_FIXED_AT = new Date("2026-02-28T23:59:59Z");

export async function runOnboardingApologyEmails(): Promise<RunResult> {
  const admin = createAdminClient();
  const result: RunResult = { sent: 0, skipped: 0, errors: 0 };

  const { data: usersData, error } = await admin
    .from("profiles")
    .select("id, email")
    .neq("id", ADMIN_USER_ID)
    .gte("created_at", BUG_INTRODUCED_AT.toISOString())
    .lte("created_at", BUG_FIXED_AT.toISOString());

  if (error) {
    logger.error("Error fetching onboarding apology candidates:", error);
    return result;
  }

  if (usersData.length === 0) return result;

  const userIds = usersData.map((u) => u.id);

  // Deduplication — skip users who already received this email
  const alreadySentIds = await getAlreadySentIds(
    admin,
    "onboarding_apology",
    userIds,
  );

  for (const user of usersData) {
    if (alreadySentIds.has(user.id)) {
      result.skipped++;
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      const logId = await insertEmailLog(admin, user.id, "onboarding_apology");

      const trackingPixel = getTrackingPixelHtml(logId);

      const html = founderEmail(
        p("Hey,") +
          p(
            "I wanted to personally apologize. If you signed up for BriefTube recently and felt stuck, being redirected in a loop and unable to reach your dashboard, that was our fault.",
          ) +
          p(
            "A bug in our onboarding flow was silently preventing accounts from being properly activated. It affected a number of users who signed up over the past week, including you.",
          ) +
          p(
            "<strong>We've fixed it.</strong> Your account is now fully unlocked and you can access your dashboard normally at <a href='https://www.brief-tube.com/dashboard' style='color:#1a1a1a;'>brief-tube.com/dashboard</a>",
          ) +
          p(
            "If you get a chance to try it and have any feedback, good or bad, I'd genuinely love to hear it. Just hit reply.",
          ) +
          p("Thank you for signing up, and sorry again for the trouble.") +
          signature() +
          trackingPixel,
      );

      // eslint-disable-next-line no-await-in-loop
      await sendEmail({
        from: "Vin from BriefTube <vin@brief-tube.com>",
        to: user.email,
        replyTo: env.NEXT_PUBLIC_EMAIL_CONTACT ?? "contact@brief-tube.com",
        subject: "Sorry, your BriefTube account is now working",
        html,
        headers: getUnsubscribeHeaders(user.id, "announcements"),
      });

      result.sent++;
      logger.info("Onboarding apology email sent", { userId: user.id });
    } catch (err) {
      result.errors++;
      logger.error("Failed to send onboarding apology email", {
        userId: user.id,
        err,
      });
    }
  }

  return result;
}

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

// Detection window: signed up between 12h and 36h ago (center at 24h, ±12h)
function getSignupWindow(): { from: Date; to: Date } {
  const now = Date.now();
  const h = 3600_000;
  return { from: new Date(now - 36 * h), to: new Date(now - 12 * h) };
}

export async function runActivationEmails(): Promise<RunResult> {
  const admin = createAdminClient();
  const { from, to } = getSignupWindow();
  const result: RunResult = { sent: 0, skipped: 0, errors: 0 };

  // Users who signed up ~24h ago
  const { data: candidates, error } = await admin
    .from("profiles")
    .select("id, email")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  if (error) {
    logger.error("Error fetching activation candidates:", error);
    return result;
  }

  if (candidates.length === 0) {
    return result;
  }

  const candidateIds = candidates.map((u) => u.id);

  // Exclude users who already connected any delivery platform
  const { data: platformConns } = await admin
    .from("platform_connections")
    .select("user_id")
    .eq("connected", true)
    .in("user_id", candidateIds);

  const alreadyConnectedIds = new Set(
    (platformConns ?? []).map((c) => c.user_id),
  );

  const usersData = candidates.filter((u) => !alreadyConnectedIds.has(u.id));

  if (usersData.length === 0) {
    return result;
  }

  const userIds = usersData.map((u) => u.id);

  // Deduplication via email_logs
  const alreadySentIds = await getAlreadySentIds(
    admin,
    "activation_telegram",
    userIds,
  );

  for (const user of usersData) {
    if (alreadySentIds.has(user.id)) {
      result.skipped++;
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      const logId = await insertEmailLog(admin, user.id, "activation_telegram");

      const trackingPixel = getTrackingPixelHtml(logId);

      const html = founderEmail(
        p("Hey,") +
          p(
            "I noticed you signed up for BriefTube yesterday but haven't connected a delivery channel yet, so you haven't received any audio summaries.",
          ) +
          p(
            "BriefTube can deliver your summaries to <strong>Telegram, Discord, or Slack</strong>, whichever you already use. There's also a private podcast RSS feed if you prefer listening in Overcast, Pocket Casts, or Apple Podcasts.",
          ) +
          p(
            "It takes about 30 seconds to connect: <a href='https://www.brief-tube.com/dashboard/profile' style='color:#1a1a1a;'>brief-tube.com/dashboard/profile</a>",
          ) +
          p(
            "If something stopped you (wrong platform, unclear setup, something else), just hit reply. I read every response and it directly shapes what we build.",
          ) +
          signature() +
          trackingPixel,
      );

      // eslint-disable-next-line no-await-in-loop
      await sendEmail({
        from: "Vin from BriefTube <vin@brief-tube.com>",
        to: user.email,
        replyTo: env.NEXT_PUBLIC_EMAIL_CONTACT ?? "contact@brief-tube.com",
        subject: "Quick question about your BriefTube account",
        html,
      });

      result.sent++;
      logger.info("Activation email sent", { userId: user.id });
    } catch (err) {
      result.errors++;
      logger.error("Failed to send activation email", { userId: user.id, err });
    }
  }

  return result;
}

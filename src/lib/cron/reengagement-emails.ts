import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send-email";
import { founderEmail, p, signature } from "@/lib/mail/founder-email";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

export type RunResult = {
  sent: number;
  skipped: number;
  errors: number;
};

const EMAIL_TYPE = "reengagement_7d";

export async function runReengagementEmails(): Promise<RunResult> {
  const admin = createAdminClient();
  const result: RunResult = { sent: 0, skipped: 0, errors: 0 };

  // Step 1 — Pro users with telegram connected and at least one active channel
  const { data: activeSubs, error: subsError } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("active", true);

  if (subsError) {
    logger.error(
      "Reengagement: error fetching active subscriptions:",
      subsError,
    );
    return result;
  }

  const activeSubUserIds = [...new Set(activeSubs.map((s) => s.user_id))];

  if (activeSubUserIds.length === 0) {
    return result;
  }

  const { data: candidates, error: profilesError } = await admin
    .from("profiles")
    .select("id, email")
    .eq("subscription_status", "active")
    .eq("telegram_connected", true)
    .in("id", activeSubUserIds);

  if (profilesError) {
    logger.error("Reengagement: error fetching Pro profiles:", profilesError);
    return result;
  }

  if (candidates.length === 0) {
    return result;
  }

  const candidateIds = candidates.map((u) => u.id);

  // Step 2 — Exclude users who received a delivery in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const { data: recentDeliveries } = await admin
    .from("deliveries")
    .select("user_id")
    .eq("status", "sent")
    .gte("created_at", sevenDaysAgo)
    .in("user_id", candidateIds);

  const recentDeliveryIds = new Set(
    (recentDeliveries ?? []).map((d) => d.user_id),
  );

  // Keep only users with 0 deliveries in 7 days
  const inactiveUsers = candidates.filter((u) => !recentDeliveryIds.has(u.id));

  if (inactiveUsers.length === 0) {
    return result;
  }

  // Step 3 — Deduplication via email_logs
  const inactiveIds = inactiveUsers.map((u) => u.id);

  const { data: logs } = await admin
    .from("email_logs")
    .select("user_id")
    .eq("email_type", EMAIL_TYPE)
    .in("user_id", inactiveIds);

  const alreadySentIds = new Set((logs ?? []).map((l) => l.user_id));

  // Step 4 — Send emails
  for (const user of inactiveUsers) {
    if (alreadySentIds.has(user.id)) {
      result.skipped++;
      continue;
    }

    try {
      const html = founderEmail(
        p("Hey,") +
          p(
            "I checked and noticed you haven't received any BriefTube summaries in the past week.",
          ) +
          p(
            "That usually means the channels you follow haven't posted new videos recently. Completely normal for some creators.",
          ) +
          p(
            "If that's the case, it might be worth adding a few more active channels to your list. The more you track, the more summaries land in your Telegram.",
          ) +
          p(
            "You can add channels directly from your dashboard: <a href='https://www.brief-tube.com/dashboard' style='color:#1a1a1a;'>brief-tube.com/dashboard</a>",
          ) +
          p(
            "Also, is everything working fine on your end? If something broke or you're not getting summaries as expected, just reply and I'll look into it personally.",
          ) +
          signature(),
      );

      // eslint-disable-next-line no-await-in-loop
      await sendEmail({
        from: "Vin from BriefTube <vin@brief-tube.com>",
        to: user.email,
        replyTo: env.NEXT_PUBLIC_EMAIL_CONTACT ?? "contact@brief-tube.com",
        subject: "Your BriefTube channels have been quiet this week",
        html,
      });

      // eslint-disable-next-line no-await-in-loop
      await admin
        .from("email_logs")
        .insert({ user_id: user.id, email_type: EMAIL_TYPE });

      result.sent++;
      logger.info("Reengagement email sent", { userId: user.id });
    } catch (err) {
      result.errors++;
      logger.error("Failed to send reengagement email", {
        userId: user.id,
        err,
      });
    }
  }

  return result;
}

import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send-email";
import { founderEmail, p, signature } from "@/lib/mail/founder-email";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

// Detection window: signed up between 12h and 36h ago (center at 24h, ±12h)
function getSignupWindow(): { from: Date; to: Date } {
  const now = Date.now();
  const h = 3600_000;
  return { from: new Date(now - 36 * h), to: new Date(now - 12 * h) };
}

type RunResult = {
  sent: number;
  skipped: number;
  errors: number;
};

export async function runActivationEmails(): Promise<RunResult> {
  const admin = createAdminClient();
  const { from, to } = getSignupWindow();
  const result: RunResult = { sent: 0, skipped: 0, errors: 0 };

  // Users who signed up ~24h ago and still haven't connected Telegram
  const { data: usersData, error } = await admin
    .from("profiles")
    .select("id, email")
    .eq("telegram_connected", false)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  if (error) {
    logger.error("Error fetching activation candidates:", error);
    return result;
  }

  if (usersData.length === 0) {
    return result;
  }

  const userIds = usersData.map((u) => u.id);

  // Deduplication via email_logs
  const { data: logs } = await admin
    .from("email_logs")
    .select("user_id")
    .eq("email_type", "activation_telegram")
    .in("user_id", userIds);

  const alreadySentIds = new Set((logs ?? []).map((l) => l.user_id));

  for (const user of usersData) {
    if (alreadySentIds.has(user.id)) {
      result.skipped++;
      continue;
    }

    try {
      const html = founderEmail(
        p("Hey,") +
          p(
            "I noticed you signed up for BriefTube yesterday but didn't connect your Telegram yet, so you haven't received any audio summaries.",
          ) +
          p(
            "I wanted to reach out personally to ask: <strong>why didn't you connect Telegram?</strong>",
          ) +
          p(
            "Is it because you don't use Telegram? Would you prefer to receive your summaries somewhere else, like WhatsApp or email? Or is there something else that stopped you?",
          ) +
          p(
            "Just hit reply and tell me. I read every response and this directly shapes what we build next.",
          ) +
          p(
            "If you want to give it a try, connecting Telegram takes 30 seconds: <a href='https://www.brief-tube.com/dashboard' style='color:#1a1a1a;'>brief-tube.com/dashboard</a>",
          ) +
          signature(),
      );

      // eslint-disable-next-line no-await-in-loop
      await sendEmail({
        from: "Vin from BriefTube <vin@brief-tube.com>",
        to: user.email,
        replyTo: env.NEXT_PUBLIC_EMAIL_CONTACT ?? "contact@brief-tube.com",
        subject: "Quick question about your BriefTube account",
        html,
      });

      // eslint-disable-next-line no-await-in-loop
      await admin
        .from("email_logs")
        .insert({ user_id: user.id, email_type: "activation_telegram" });

      result.sent++;
      logger.info("Activation email sent", { userId: user.id });
    } catch (err) {
      result.errors++;
      logger.error("Failed to send activation email", { userId: user.id, err });
    }
  }

  return result;
}

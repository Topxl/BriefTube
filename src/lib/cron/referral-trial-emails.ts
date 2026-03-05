import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send-email";
import { ReferralTrialEmail } from "@/components/emails/referral-trial-email";
import { logger } from "@/lib/logger";
import { SiteConfig } from "@/site-config";

export type RunResult = {
  sent: number;
  skipped: number;
  errors: number;
};

type EmailType = "referral_trial_j3" | "referral_trial_j1";

// Same windows as trial-reminders
function getTimeWindow(type: EmailType): { from: Date; to: Date } {
  const now = Date.now();
  const h = 3600_000;
  if (type === "referral_trial_j3") {
    return { from: new Date(now + 60 * h), to: new Date(now + 84 * h) };
  }
  // referral_trial_j1
  return { from: new Date(now + 12 * h), to: new Date(now + 36 * h) };
}

// Extract a readable first name from an email address.
// "john.doe@gmail.com" -> "John"
// "randomstring123@..." -> "a friend"
function extractFirstName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._+-]/)[0] ?? "";
  if (first.length < 2 || !/[aeiouAEIOU]/.test(first)) return "a friend";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

async function processReferralEmailType(type: EmailType): Promise<RunResult> {
  const admin = createAdminClient();
  const result: RunResult = { sent: 0, skipped: 0, errors: 0 };
  const { from, to } = getTimeWindow(type);

  // 1. Users in trial window on free plan
  const { data: trialUsers, error: trialError } = await admin
    .from("profiles")
    .select("id, email, trial_ends_at")
    .eq("subscription_status", "free")
    .not("trial_ends_at", "is", null)
    .gte("trial_ends_at", from.toISOString())
    .lte("trial_ends_at", to.toISOString());

  if (trialError) {
    logger.error(
      "Referral trial emails: error fetching trial users:",
      trialError,
    );
    return result;
  }

  const trialUserIds = trialUsers
    .filter((u) => u.trial_ends_at !== null)
    .map((u) => u.id);

  if (trialUserIds.length === 0) return result;

  // 2. Keep only users who were referred (appear as referee in referrals table)
  const { data: referralRows, error: referralError } = await admin
    .from("referrals")
    .select("referee_id, referrer_id")
    .in("referee_id", trialUserIds);

  if (referralError) {
    logger.error(
      "Referral trial emails: error fetching referrals:",
      referralError,
    );
    return result;
  }

  if (referralRows.length === 0) return result;

  const referralMap = new Map(
    referralRows.map((r) => [r.referee_id, r.referrer_id]),
  );
  const referredUserIds = [...referralMap.keys()];

  // 3. Deduplication
  const { data: logs } = await admin
    .from("email_logs")
    .select("user_id")
    .eq("email_type", type)
    .in("user_id", referredUserIds);

  const alreadySentIds = new Set((logs ?? []).map((l) => l.user_id));

  // 4. Fetch referrer emails for name extraction
  const referrerIds = [...new Set(referralRows.map((r) => r.referrer_id))];
  const { data: referrerProfiles } = await admin
    .from("profiles")
    .select("id, email")
    .in("id", referrerIds);

  const referrerEmailMap = new Map(
    (referrerProfiles ?? []).map((p) => [p.id, p.email]),
  );

  // 5. Send emails
  for (const user of trialUsers) {
    if (!user.trial_ends_at) continue;
    const referrerId = referralMap.get(user.id);
    if (!referrerId) continue;
    if (alreadySentIds.has(user.id)) {
      result.skipped++;
      continue;
    }

    const referrerEmail = referrerEmailMap.get(referrerId) ?? "";
    const referrerName = extractFirstName(referrerEmail);
    const daysLeft = Math.ceil(
      (new Date(user.trial_ends_at).getTime() - Date.now()) / 86_400_000,
    );

    try {
      const subject =
        daysLeft <= 1
          ? `${referrerName} is on BriefTube Pro. Your trial ends tomorrow`
          : `${referrerName} is on BriefTube Pro. Your trial ends in ${daysLeft} days`;

      // eslint-disable-next-line no-await-in-loop
      const { data: log } = await admin
        .from("email_logs")
        .insert({ user_id: user.id, email_type: type })
        .select("id")
        .single();

      const trackingPixelUrl = log?.id
        ? `${SiteConfig.prodUrl}/api/email/track/${log.id}`
        : undefined;

      // eslint-disable-next-line no-await-in-loop
      await sendEmail({
        to: user.email,
        subject,
        html: ReferralTrialEmail({ daysLeft, referrerName, trackingPixelUrl }),
      });

      result.sent++;
      logger.info("Referral trial email sent", {
        type,
        userId: user.id,
        referrerName,
      });
    } catch (err) {
      result.errors++;
      logger.error("Failed to send referral trial email", {
        type,
        userId: user.id,
        err,
      });
    }
  }

  return result;
}

export type ReferralTrialResult = {
  j3: RunResult;
  j1: RunResult;
};

export async function runReferralTrialEmails(): Promise<ReferralTrialResult> {
  logger.info("Running referral trial emails...");

  const [j3, j1] = await Promise.all([
    processReferralEmailType("referral_trial_j3"),
    processReferralEmailType("referral_trial_j1"),
  ]);

  logger.info("Referral trial emails done", { j3, j1 });

  return { j3, j1 };
}

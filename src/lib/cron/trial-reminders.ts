import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send-email";
import { TrialReminderEmail } from "@/components/emails/trial-reminder-email";
import { TrialExpiredEmail } from "@/components/emails/trial-expired-email";
import { logger } from "@/lib/logger";
import { SiteConfig } from "@/site-config";
import type { RunResult } from "@/lib/email/email-helpers";
import { getAlreadySentIds, insertEmailLog } from "@/lib/email/email-helpers";
import { getUnsubscribeHeaders } from "@/lib/mail/unsubscribe";

type EmailType = "trial_reminder_j3" | "trial_reminder_j1" | "trial_expired";

type TrialUser = {
  id: string;
  email: string;
  trial_ends_at: string;
};

// Detection windows centered around target (±12h)
// J-3: trial ends between now+60h and now+84h
// J-1: trial ends between now+12h and now+36h
// Expired: trial ended between now-36h and now-12h
function getTimeWindow(type: EmailType): { from: Date; to: Date } {
  const now = Date.now();
  const h = 3600_000;

  if (type === "trial_reminder_j3") {
    return { from: new Date(now + 60 * h), to: new Date(now + 84 * h) };
  }
  if (type === "trial_reminder_j1") {
    return { from: new Date(now + 12 * h), to: new Date(now + 36 * h) };
  }
  // trial_expired
  return { from: new Date(now - 36 * h), to: new Date(now - 12 * h) };
}

async function getUsersInWindow(
  type: EmailType,
): Promise<{ users: TrialUser[]; alreadySentIds: Set<string> }> {
  const admin = createAdminClient();
  const { from, to } = getTimeWindow(type);

  // Get users whose trial_ends_at falls in the window (free plan only)
  const { data: usersData, error } = await admin
    .from("profiles")
    .select("id, email, trial_ends_at")
    .eq("subscription_status", "free")
    .not("trial_ends_at", "is", null)
    .gte("trial_ends_at", from.toISOString())
    .lte("trial_ends_at", to.toISOString());

  if (error) {
    logger.error("Error fetching trial users:", error);
    return { users: [], alreadySentIds: new Set() };
  }

  const users = usersData.filter(
    (u): u is TrialUser => u.trial_ends_at !== null,
  );

  if (users.length === 0) {
    return { users: [], alreadySentIds: new Set() };
  }

  // Check which users already received this email type
  const userIds = users.map((u) => u.id);
  const alreadySentIds = await getAlreadySentIds(admin, type, userIds);

  return { users, alreadySentIds };
}

async function sendTrialEmail(
  user: TrialUser,
  type: EmailType,
  trackingPixelUrl?: string,
): Promise<void> {
  const trialEndsAt = new Date(user.trial_ends_at);
  const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000);

  if (type === "trial_expired") {
    await sendEmail({
      to: user.email,
      subject: "upgrade now to keep your channels",
      html: TrialExpiredEmail({ trackingPixelUrl }),
      headers: getUnsubscribeHeaders(user.id, "announcements"),
    });
  } else {
    await sendEmail({
      to: user.email,
      subject:
        daysLeft <= 1
          ? "last day, don't lose your summaries"
          : `${daysLeft} days left to upgrade`,
      html: TrialReminderEmail({ daysLeft, trackingPixelUrl }),
      headers: getUnsubscribeHeaders(user.id, "announcements"),
    });
  }
}

async function processEmailType(type: EmailType): Promise<RunResult> {
  const { users, alreadySentIds } = await getUsersInWindow(type);
  const admin = createAdminClient();
  const result: RunResult = { sent: 0, skipped: 0, errors: 0 };

  for (const user of users) {
    if (alreadySentIds.has(user.id)) {
      result.skipped++;
      continue;
    }

    try {
      // Insert log first to get tracking ID, then send
      // eslint-disable-next-line no-await-in-loop
      const logId = await insertEmailLog(admin, user.id, type);
      const trackingPixelUrl = logId
        ? `${SiteConfig.prodUrl}/api/email/track/${logId}`
        : undefined;
      // eslint-disable-next-line no-await-in-loop
      await sendTrialEmail(user, type, trackingPixelUrl);
      result.sent++;
      logger.info(`Trial email sent`, { type, userId: user.id });
    } catch (err) {
      result.errors++;
      logger.error(`Failed to send trial email`, {
        type,
        userId: user.id,
        err,
      });
    }
  }

  return result;
}

export type TrialRemindersResult = {
  j3: RunResult;
  j1: RunResult;
  expired: RunResult;
};

export async function runTrialReminders(): Promise<TrialRemindersResult> {
  logger.info("Running trial reminders...");

  const [j3, j1, expired] = await Promise.all([
    processEmailType("trial_reminder_j3"),
    processEmailType("trial_reminder_j1"),
    processEmailType("trial_expired"),
  ]);

  logger.info("Trial reminders done", { j3, j1, expired });

  return { j3, j1, expired };
}

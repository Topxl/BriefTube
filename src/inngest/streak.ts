import { render } from "@react-email/render";
import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send-email";
import { env } from "@/lib/env";
import { SiteConfig } from "@/site-config";
import { StreakBreakWarningEmail } from "@/components/emails/streak-break-warning-email";
import { getUnsubscribeHeaders } from "@/lib/mail/unsubscribe";

const EMAIL_TYPE = "streak_break_warning";

function toUtcDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeStreakEndingAt(
  engagementDays: Set<string>,
  endDate: Date,
): number {
  if (engagementDays.size === 0) return 0;

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(endDate);
    d.setUTCDate(d.getUTCDate() - i);
    if (engagementDays.has(toUtcDateStr(d))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function computeBestStreak(engagementDays: Set<string>): number {
  if (engagementDays.size === 0) return 0;

  const sorted = [...engagementDays].sort();
  let best = 1;
  let run = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] ?? "");
    const curr = new Date(sorted[i] ?? "");
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    if (diff === 1) {
      run += 1;
      if (run > best) best = run;
    } else if (diff > 1) {
      run = 1;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Cron trigger — daily at 18 UTC (evening EU, afternoon Americas)
// Finds users whose streak is alive (engaged yesterday) but haven't engaged
// today, streak ≥ 3, and haven't been warned today.
// ---------------------------------------------------------------------------

export const streakBreakWarningTrigger = inngest.createFunction(
  {
    id: "streak-break-warning-trigger",
    triggers: [{ cron: "TZ=UTC 0 18 * * *" }],
  },
  async ({ step }) => {
    const users = await step.run("find-at-risk-users", async () => {
      const supabase = createAdminClient();

      const now = new Date();
      const today = toUtcDateStr(now);
      const yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = toUtcDateStr(yesterday);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);

      // Fetch recent engagement for every user in one shot
      const { data: rows } = await supabase
        .from("deliveries")
        .select("user_id, listened_at")
        .not("listened_at", "is", null)
        .gte("listened_at", sixtyDaysAgo.toISOString());

      if (!rows || rows.length === 0) return [];

      // Group engagement days per user
      const userDays = new Map<string, Set<string>>();
      for (const row of rows) {
        if (!row.listened_at) continue;
        const day = toUtcDateStr(new Date(row.listened_at));
        const set = userDays.get(row.user_id) ?? new Set<string>();
        set.add(day);
        userDays.set(row.user_id, set);
      }

      // Filter: engaged yesterday AND not today
      const atRiskIds: string[] = [];
      const streakByUser = new Map<string, number>();
      const bestByUser = new Map<string, number>();

      for (const [userId, days] of userDays) {
        if (days.has(today)) continue;
        if (!days.has(yesterdayStr)) continue;
        const streak = computeStreakEndingAt(days, yesterday);
        if (streak < 3) continue;
        atRiskIds.push(userId);
        streakByUser.set(userId, streak);
        bestByUser.set(userId, Math.max(streak, computeBestStreak(days)));
      }

      if (atRiskIds.length === 0) return [];

      // Fetch emails + check email preferences
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, email_announcements")
        .in("id", atRiskIds)
        .not("email", "is", null);

      const eligibleProfiles = (profiles ?? []).filter(
        (p) => p.email_announcements !== false && !!p.email,
      );
      if (eligibleProfiles.length === 0) return [];

      // Exclude users already warned today (dedup)
      const startOfTodayUtc = new Date(`${today}T00:00:00Z`);
      const { data: alreadySent } = await supabase
        .from("email_logs")
        .select("user_id")
        .eq("email_type", EMAIL_TYPE)
        .in(
          "user_id",
          eligibleProfiles.map((p) => p.id),
        )
        .gte("sent_at", startOfTodayUtc.toISOString());

      const warnedToday = new Set((alreadySent ?? []).map((l) => l.user_id));

      return eligibleProfiles
        .filter((p) => !warnedToday.has(p.id))
        .map((p) => ({
          userId: p.id,
          email: p.email,
          streak: streakByUser.get(p.id) ?? 0,
          bestStreak: bestByUser.get(p.id) ?? 0,
        }));
    });

    if (users.length === 0) return { queued: 0 };

    await step.sendEvent(
      "fan-out-streak-warnings",
      users.map((u) => ({
        name: "streak/send-warning" as const,
        data: u,
      })),
    );

    return { queued: users.length };
  },
);

// ---------------------------------------------------------------------------
// Per-user send — renders and sends the warning email
// ---------------------------------------------------------------------------

export const sendStreakBreakWarning = inngest.createFunction(
  {
    id: "streak-break-warning-send",
    retries: 2,
    triggers: [{ event: "streak/send-warning" }],
  },
  async ({ event, step }) => {
    const { userId, email, streak, bestStreak } = event.data as {
      userId: string;
      email: string;
      streak: number;
      bestStreak: number;
    };

    await step.run("send-email", async () => {
      const supabase = createAdminClient();

      // Insert log first to reserve the ID for the tracking pixel
      const { data: log } = await supabase
        .from("email_logs")
        .insert({
          user_id: userId,
          email_type: EMAIL_TYPE,
          sent_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      const trackingPixelUrl = log
        ? `${SiteConfig.prodUrl}/api/email/track/${log.id}`
        : undefined;

      const dashboardUrl = `${SiteConfig.prodUrl}/dashboard?ref=streak_warning`;

      const html = await render(
        StreakBreakWarningEmail({
          dashboardUrl,
          streak,
          bestStreak,
          trackingPixelUrl,
        }),
      );

      await sendEmail({
        from: env.EMAIL_FROM ?? `BriefTube <hello@${SiteConfig.domain}>`,
        to: email,
        subject: `Your ${streak}-day streak is about to break`,
        html,
        headers: getUnsubscribeHeaders(userId, "announcements"),
      });
    });

    return { sent: true };
  },
);

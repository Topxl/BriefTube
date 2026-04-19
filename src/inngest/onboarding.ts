import { render } from "@react-email/render";
import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send-email";
import { env } from "@/lib/env";
import { SiteConfig } from "@/site-config";
import { OnboardingJ1Email } from "@/components/emails/onboarding-j1-email";
import { OnboardingJ3Email } from "@/components/emails/onboarding-j3-email";
import { ActivationEmail } from "@/components/emails/activation-email";
import { getUnsubscribeHeaders } from "@/lib/mail/unsubscribe";

// ---------------------------------------------------------------------------
// Helper: fetch users eligible for an onboarding email
// Created between [minHoursAgo, maxHoursAgo], have ≥1 delivery, not yet sent
// ---------------------------------------------------------------------------

async function fetchEligibleUsers(
  emailType: "onboarding_j1" | "onboarding_j3",
  minHoursAgo: number,
  maxHoursAgo: number,
) {
  const supabase = createAdminClient();
  const now = Date.now();
  const minDate = new Date(now - maxHoursAgo * 3600 * 1000).toISOString();
  const maxDate = new Date(now - minHoursAgo * 3600 * 1000).toISOString();

  // Users created in the time window
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .gte("created_at", minDate)
    .lte("created_at", maxDate)
    .not("email", "is", null);

  if (!profiles || profiles.length === 0) return [];

  const userIds = profiles.map((p) => p.id);

  // Already sent this email
  const { data: logs } = await supabase
    .from("email_logs")
    .select("user_id")
    .eq("email_type", emailType)
    .in("user_id", userIds);

  const alreadySent = new Set((logs ?? []).map((l) => l.user_id));

  // Have at least 1 delivery (any status, they activated)
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("user_id")
    .in("user_id", userIds)
    .eq("status", "sent");

  const hasDelivery = new Set((deliveries ?? []).map((d) => d.user_id));

  return profiles.filter(
    (p) => !alreadySent.has(p.id) && hasDelivery.has(p.id) && !!p.email,
  );
}

// ---------------------------------------------------------------------------
// J+1: "Add more channels" (cron every hour)
// ---------------------------------------------------------------------------

export const onboardingJ1Trigger = inngest.createFunction(
  {
    id: "onboarding-j1-trigger",
    triggers: [{ cron: "TZ=UTC 30 * * * *" }], // run at :30 each hour (stagger vs newsletter)
  },
  async ({ step }) => {
    const users = await step.run("fetch-eligible-j1", async () =>
      fetchEligibleUsers("onboarding_j1", 24, 48),
    );

    if (users.length === 0) return { sent: 0 };

    await step.sendEvent(
      "fan-out-j1",
      users.map((u) => ({
        name: "onboarding/send-j1" as const,
        data: { userId: u.id, email: u.email },
      })),
    );

    return { queued: users.length };
  },
);

export const sendOnboardingJ1 = inngest.createFunction(
  {
    id: "onboarding-send-j1",
    retries: 2,
    triggers: [{ event: "onboarding/send-j1" }],
  },
  async ({ event, step }) => {
    const { userId, email } = event.data as { userId: string; email: string };

    await step.run("send-email", async () => {
      const html = await render(
        OnboardingJ1Email({ dashboardUrl: `${SiteConfig.prodUrl}/dashboard` }),
      );

      await sendEmail({
        from: env.EMAIL_FROM ?? `BriefTube <hello@${SiteConfig.domain}>`,
        to: email,
        subject: "add more channels to your dashboard",
        html,
        headers: getUnsubscribeHeaders(userId, "announcements"),
      });

      const supabase = createAdminClient();
      await supabase.from("email_logs").insert({
        user_id: userId,
        email_type: "onboarding_j1",
        sent_at: new Date().toISOString(),
      });
    });

    return { sent: true };
  },
);

// ---------------------------------------------------------------------------
// J+3: "Did you know about languages?" (cron every hour)
// ---------------------------------------------------------------------------

export const onboardingJ3Trigger = inngest.createFunction(
  {
    id: "onboarding-j3-trigger",
    triggers: [{ cron: "TZ=UTC 45 * * * *" }], // run at :45 each hour
  },
  async ({ step }) => {
    const users = await step.run("fetch-eligible-j3", async () =>
      fetchEligibleUsers("onboarding_j3", 72, 96),
    );

    if (users.length === 0) return { sent: 0 };

    await step.sendEvent(
      "fan-out-j3",
      users.map((u) => ({
        name: "onboarding/send-j3" as const,
        data: { userId: u.id, email: u.email },
      })),
    );

    return { queued: users.length };
  },
);

export const sendOnboardingJ3 = inngest.createFunction(
  {
    id: "onboarding-send-j3",
    retries: 2,
    triggers: [{ event: "onboarding/send-j3" }],
  },
  async ({ event, step }) => {
    const { userId, email } = event.data as { userId: string; email: string };

    await step.run("send-email", async () => {
      const html = await render(
        OnboardingJ3Email({
          profileUrl: `${SiteConfig.prodUrl}/dashboard/profile`,
        }),
      );

      await sendEmail({
        from: env.EMAIL_FROM ?? `BriefTube <hello@${SiteConfig.domain}>`,
        to: email,
        subject: "we support 190+ languages",
        html,
        headers: getUnsubscribeHeaders(userId, "announcements"),
      });

      const supabase = createAdminClient();
      await supabase.from("email_logs").insert({
        user_id: userId,
        email_type: "onboarding_j3",
        sent_at: new Date().toISOString(),
      });
    });

    return { sent: true };
  },
);

// ---------------------------------------------------------------------------
// Activation J+1: users who signed up but haven't connected a channel yet.
// Complements J+1/J+3 which only target users with ≥1 delivery.
// ---------------------------------------------------------------------------

async function fetchUsersWithoutDelivery(
  emailType: "activation_j1",
  minHoursAgo: number,
  maxHoursAgo: number,
) {
  const supabase = createAdminClient();
  const now = Date.now();
  const minDate = new Date(now - maxHoursAgo * 3600 * 1000).toISOString();
  const maxDate = new Date(now - minHoursAgo * 3600 * 1000).toISOString();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .gte("created_at", minDate)
    .lte("created_at", maxDate)
    .not("email", "is", null);

  if (!profiles || profiles.length === 0) return [];

  const userIds = profiles.map((p) => p.id);

  const { data: logs } = await supabase
    .from("email_logs")
    .select("user_id")
    .eq("email_type", emailType)
    .in("user_id", userIds);

  const alreadySent = new Set((logs ?? []).map((l) => l.user_id));

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("user_id")
    .in("user_id", userIds)
    .eq("status", "sent");

  const hasDelivery = new Set((deliveries ?? []).map((d) => d.user_id));

  return profiles.filter(
    (p) => !alreadySent.has(p.id) && !hasDelivery.has(p.id) && !!p.email,
  );
}

export const activationJ1Trigger = inngest.createFunction(
  {
    id: "activation-j1-trigger",
    triggers: [{ cron: "TZ=UTC 15 * * * *" }],
  },
  async ({ step }) => {
    const users = await step.run("fetch-eligible-activation", async () =>
      fetchUsersWithoutDelivery("activation_j1", 24, 48),
    );

    if (users.length === 0) return { queued: 0 };

    await step.sendEvent(
      "fan-out-activation",
      users.map((u) => ({
        name: "onboarding/send-activation" as const,
        data: { userId: u.id, email: u.email },
      })),
    );

    return { queued: users.length };
  },
);

export const sendActivationEmail = inngest.createFunction(
  {
    id: "activation-send",
    retries: 2,
    triggers: [{ event: "onboarding/send-activation" }],
  },
  async ({ event, step }) => {
    const { userId, email } = event.data as { userId: string; email: string };

    await step.run("send-email", async () => {
      const html = await render(
        ActivationEmail({ dashboardUrl: `${SiteConfig.prodUrl}/dashboard` }),
      );

      await sendEmail({
        from: env.EMAIL_FROM ?? `BriefTube <hello@${SiteConfig.domain}>`,
        to: email,
        subject: "You haven't connected a channel yet",
        html,
        headers: getUnsubscribeHeaders(userId, "announcements"),
      });

      const supabase = createAdminClient();
      await supabase.from("email_logs").insert({
        user_id: userId,
        email_type: "activation_j1",
        sent_at: new Date().toISOString(),
      });
    });

    return { sent: true };
  },
);

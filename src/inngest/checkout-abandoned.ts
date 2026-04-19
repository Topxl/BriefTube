import { render } from "@react-email/render";
import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send-email";
import { env } from "@/lib/env";
import { SiteConfig } from "@/site-config";
import { CheckoutAbandonedEmail } from "@/components/emails/checkout-abandoned-email";
import { getUnsubscribeHeaders } from "@/lib/mail/unsubscribe";

const EMAIL_TYPE = "checkout_abandoned";

type EligibleUser = {
  id: string;
  email: string;
  trial_ends_at: string | null;
};

async function fetchAbandonedCheckoutUsers(
  minHoursAgo: number,
  maxHoursAgo: number,
): Promise<EligibleUser[]> {
  const supabase = createAdminClient();
  const now = Date.now();
  const minDate = new Date(now - maxHoursAgo * 3600 * 1000).toISOString();
  const maxDate = new Date(now - minHoursAgo * 3600 * 1000).toISOString();

  const { data: rows } = await supabase
    .from("abandoned_checkouts")
    .select("user_id")
    .is("recovered_at", null)
    .gte("created_at", minDate)
    .lte("created_at", maxDate);

  if (!rows || rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, trial_ends_at, stripe_subscription_id")
    .in("id", userIds)
    .not("email", "is", null)
    .is("stripe_subscription_id", null);

  if (!profiles || profiles.length === 0) return [];

  const { data: alreadySentLogs } = await supabase
    .from("email_logs")
    .select("user_id")
    .eq("email_type", EMAIL_TYPE)
    .in(
      "user_id",
      profiles.map((p) => p.id),
    );

  const alreadySent = new Set((alreadySentLogs ?? []).map((l) => l.user_id));

  return profiles
    .filter((p) => !alreadySent.has(p.id) && !!p.email)
    .map((p) => ({
      id: p.id,
      email: p.email,
      trial_ends_at: p.trial_ends_at,
    }));
}

export const checkoutAbandonedTrigger = inngest.createFunction(
  {
    id: "checkout-abandoned-trigger",
    triggers: [{ cron: "TZ=UTC 15 * * * *" }],
  },
  async ({ step }) => {
    const users = await step.run("fetch-abandoned", async () =>
      fetchAbandonedCheckoutUsers(24, 48),
    );

    if (users.length === 0) return { queued: 0 };

    await step.sendEvent(
      "fan-out-checkout-abandoned",
      users.map((u) => ({
        name: "checkout-abandoned/send" as const,
        data: {
          userId: u.id,
          email: u.email,
          trialEndsAt: u.trial_ends_at,
        },
      })),
    );

    return { queued: users.length };
  },
);

export const sendCheckoutAbandoned = inngest.createFunction(
  {
    id: "checkout-abandoned-send",
    retries: 2,
    triggers: [{ event: "checkout-abandoned/send" }],
  },
  async ({ event, step }) => {
    const { userId, email, trialEndsAt } = event.data as {
      userId: string;
      email: string;
      trialEndsAt: string | null;
    };

    await step.run("send-email", async () => {
      const html = await render(
        CheckoutAbandonedEmail({
          pricingUrl: `${SiteConfig.prodUrl}/pricing`,
          trialEndsAt,
        }),
      );

      await sendEmail({
        from: env.EMAIL_FROM ?? `BriefTube <hello@${SiteConfig.domain}>`,
        to: email,
        subject: "Need help finishing your upgrade?",
        html,
        headers: getUnsubscribeHeaders(userId, "announcements"),
      });

      const supabase = createAdminClient();
      await supabase.from("email_logs").insert({
        user_id: userId,
        email_type: EMAIL_TYPE,
        sent_at: new Date().toISOString(),
      });
    });

    return { sent: true };
  },
);
